// lib/chargeback-ban/sync.ts
// Poll a partner's chargeback-ban-signals feed and upsert into the
// local cache. The feed always returns a full snapshot, so we can
// detect removals by comparing the source_user_ids present vs. what
// we have locally. Removed entries are soft-deleted (removedAt) so
// matchers ignore them but admins can still see the history.

import { prisma } from '@/lib/db';
import { ChargebackBanIdentifierType } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  canonicalizeEmail,
  canonicalizePhone,
  canonicalizeName,
  canonicalizeAddressKey,
  canonicalizeFingerprint,
  canonicalizeIp,
} from './canonicalize';

interface FeedAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

interface FeedSignalEntry {
  source_user_id: string;
  banned_at: string;
  reason?: string;
  identifiers: {
    emails?: string[];
    phones?: string[];
    billing_names?: string[];
    billing_addresses?: FeedAddress[];
    card_fingerprints?: string[];
    last_known_ips?: string[];
    device_fingerprints?: string[];
  };
}

interface FeedResponse {
  updated_at: string;
  signals: FeedSignalEntry[];
}

export interface SyncResult {
  ok: boolean;
  feedTimestamp: Date | null;
  signalsTotal: number;
  signalsAdded: number;
  signalsUpdated: number;
  signalsRemoved: number;
  errorMessage?: string;
}

/**
 * Pull the live feed and merge it into our local cache for `partnerId`.
 * Caller provides feed URL + bearer token (loaded from getConfig).
 */
/**
 * Per-attempt budget. The cron runs every 5 minutes, so we can afford to
 * wait longer than a user-facing request would — a feed that takes 12
 * seconds is slow, not broken, and timing it out costs us the whole cycle.
 */
const FEED_TIMEOUT_MS = 15_000;

/** Attempts per sync, including the first. Backoff between them below. */
const FEED_MAX_ATTEMPTS = 3;
const FEED_RETRY_DELAY_MS = [1_000, 3_000];

/** Errors worth retrying: the far end was unreachable, slow, or transiently
 *  broken. A 4xx or an HTML body is a configuration fault — retrying just
 *  repeats it, so those fail fast. */
class TransientFeedError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One fetch attempt. Throws TransientFeedError for anything a retry might
 * fix, and a plain Error for faults that need a human.
 */
async function fetchFeedOnce(feedUrl: string, feedToken: string): Promise<FeedResponse> {
  let res: Response;
  try {
    res = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${feedToken}`,
        Accept: 'application/json',
      },
      // Do NOT follow redirects. A feed URL that 302s to a login or
      // marketing page yields a 200 with an HTML body, which used to
      // surface as an unreadable `Unexpected token '<'` JSON parse error.
      // Failing on the redirect names the actual problem instead.
      redirect: 'manual',
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TransientFeedError(`GET ${feedUrl} failed: ${msg}`);
  }

  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `Feed redirected (${res.status}) to ${res.headers.get('location') ?? 'unknown'} — ` +
        `${feedUrl} is probably not the API endpoint, or the token was rejected ` +
        `and the far end bounced us to a login page`,
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const detail = `Feed ${feedUrl} responded ${res.status}: ${errText.slice(0, 200)}`;
    // 5xx and 429 are the far end having a bad moment; 4xx is ours to fix.
    if (res.status >= 500 || res.status === 429) throw new TransientFeedError(detail);
    throw new Error(detail);
  }

  // Check the content type before parsing. A 200 carrying HTML means we
  // reached a web page rather than the API, and the JSON parse error alone
  // ("Unexpected token '<'") says nothing about which URL or what came back.
  const contentType = res.headers.get('content-type') ?? '';
  const raw = await res.text();
  if (!contentType.includes('json')) {
    throw new Error(
      `Feed ${feedUrl} returned content-type "${contentType || 'none'}" ` +
        `instead of JSON. First 200 bytes: ${raw.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
  }

  let body: FeedResponse;
  try {
    body = JSON.parse(raw) as FeedResponse;
  } catch {
    throw new Error(
      `Feed ${feedUrl} returned unparseable JSON. ` +
        `First 200 bytes: ${raw.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
  }

  if (!body || !Array.isArray(body.signals)) {
    throw new Error(`Feed ${feedUrl} response missing signals[]`);
  }

  return body;
}

/**
 * Fetch with a bounded retry. A single blip used to cost the entire 5-minute
 * cycle; the ban cache then sat stale until the next tick.
 */
async function fetchFeedSnapshot(
  feedUrl: string,
  feedToken: string,
  partnerId: string,
): Promise<FeedResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FEED_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchFeedOnce(feedUrl, feedToken);
    } catch (err) {
      lastError = err;
      if (!(err instanceof TransientFeedError) || attempt === FEED_MAX_ATTEMPTS) throw err;
      logger.warn('Chargeback ban feed attempt failed, retrying', {
        partnerId,
        feedUrl,
        attempt,
        of: FEED_MAX_ATTEMPTS,
        error: err.message,
      });
      await sleep(FEED_RETRY_DELAY_MS[attempt - 1] ?? 3_000);
    }
  }
  throw lastError;
}

export async function syncBanFeed(args: {
  partnerId: string;
  feedUrl: string;
  feedToken: string;
  /**
   * Permit a snapshot that removes every active signal. Off for the cron:
   * a partner endpoint that breaks into returning `{"signals": []}` would
   * otherwise silently soft-delete the whole local ban cache, and we would
   * log it as a successful sync. An admin running a manual sync can opt in
   * when the partner really has unbanned everyone.
   */
  allowEmptySnapshot?: boolean;
}): Promise<SyncResult> {
  const { partnerId, feedUrl, feedToken, allowEmptySnapshot = false } = args;
  const run = await prisma.chargebackBanFeedSync.create({
    data: { partnerId },
  });

  try {
    const body = await fetchFeedSnapshot(feedUrl, feedToken, partnerId);

    const feedTimestamp = body.updated_at ? new Date(body.updated_at) : new Date();

    // Wipe guard. An empty feed is only meaningful if we hold nothing, or
    // the caller explicitly accepted the removal.
    if (body.signals.length === 0 && !allowEmptySnapshot) {
      const activeLocal = await prisma.chargebackBanSignal.count({
        where: { partnerId, removedAt: null },
      });
      if (activeLocal > 0) {
        throw new Error(
          `Feed ${feedUrl} returned an empty snapshot while ${activeLocal} signal(s) ` +
            `are active locally. Refusing to soft-delete the whole ban cache — ` +
            `re-run the admin sync with allowEmptySnapshot if this is genuine`,
        );
      }
    }

    const result = await mergeFeedSnapshot(partnerId, body.signals);

    await prisma.chargebackBanFeedSync.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        feedTimestamp,
        signalsTotal: result.signalsTotal,
        signalsAdded: result.signalsAdded,
        signalsUpdated: result.signalsUpdated,
        signalsRemoved: result.signalsRemoved,
        ok: true,
      },
    });

    logger.info('Chargeback ban feed sync ok', {
      partnerId,
      total: result.signalsTotal,
      added: result.signalsAdded,
      updated: result.signalsUpdated,
      removed: result.signalsRemoved,
    });

    return { ok: true, feedTimestamp, ...result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.chargebackBanFeedSync.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, errorMessage: msg },
    });
    // feedUrl included deliberately: without it you cannot tell which
    // partner's endpoint is misconfigured from the log alone.
    logger.error('Chargeback ban feed sync failed', { partnerId, feedUrl, error: msg });
    return {
      ok: false,
      feedTimestamp: null,
      signalsTotal: 0,
      signalsAdded: 0,
      signalsUpdated: 0,
      signalsRemoved: 0,
      errorMessage: msg,
    };
  }
}

interface MergeCounters {
  signalsTotal: number;
  signalsAdded: number;
  signalsUpdated: number;
  signalsRemoved: number;
}

async function mergeFeedSnapshot(
  partnerId: string,
  feedSignals: FeedSignalEntry[],
): Promise<MergeCounters> {
  let added = 0;
  let updated = 0;
  const seenIds = new Set<string>();
  const now = new Date();

  for (const entry of feedSignals) {
    if (!entry.source_user_id) continue;
    seenIds.add(entry.source_user_id);

    const bannedAt = entry.banned_at ? new Date(entry.banned_at) : now;
    const reason = entry.reason ?? 'chargeback';

    const existing = await prisma.chargebackBanSignal.findUnique({
      where: {
        partnerId_sourceUserId: { partnerId, sourceUserId: entry.source_user_id },
      },
      select: { id: true },
    });

    let signalId: string;
    if (existing) {
      await prisma.chargebackBanSignal.update({
        where: { id: existing.id },
        data: { bannedAt, reason, lastSeenAt: now, removedAt: null },
      });
      signalId = existing.id;
      updated += 1;
    } else {
      const created = await prisma.chargebackBanSignal.create({
        data: {
          partnerId,
          sourceUserId: entry.source_user_id,
          bannedAt,
          reason,
          lastSeenAt: now,
        },
        select: { id: true },
      });
      signalId = created.id;
      added += 1;
    }

    // Identifier replace strategy: build the desired set, diff against
    // what's in the DB. We keep the row for stable id continuity if it
    // already exists; insert the new; delete the removed. createMany
    // with skipDuplicates handles the upsert path on the composite
    // unique (signalId, type, value).
    const desired = identifiersFromFeedEntry(entry, partnerId, signalId);
    const existingRows = await prisma.chargebackBanIdentifier.findMany({
      where: { signalId },
      select: { id: true, type: true, value: true },
    });
    const desiredKeys = new Set(desired.map((d) => `${d.type}|${d.value}`));
    const existingKeys = new Set(existingRows.map((r) => `${r.type}|${r.value}`));

    const toDelete = existingRows.filter((r) => !desiredKeys.has(`${r.type}|${r.value}`));
    const toInsert = desired.filter((d) => !existingKeys.has(`${d.type}|${d.value}`));

    if (toDelete.length > 0) {
      await prisma.chargebackBanIdentifier.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      });
    }
    if (toInsert.length > 0) {
      await prisma.chargebackBanIdentifier.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
    }
  }

  // Anything we have for this partner that wasn't in the feed → mark
  // removed. We never hard-delete signal rows so the match log keeps
  // a stable join target.
  const removedResult = await prisma.chargebackBanSignal.updateMany({
    where: {
      partnerId,
      removedAt: null,
      sourceUserId: { notIn: Array.from(seenIds) },
    },
    data: { removedAt: now },
  });

  return {
    signalsTotal: feedSignals.length,
    signalsAdded: added,
    signalsUpdated: updated,
    signalsRemoved: removedResult.count,
  };
}

function identifiersFromFeedEntry(
  entry: FeedSignalEntry,
  partnerId: string,
  signalId: string,
): Array<{
  signalId: string;
  partnerId: string;
  type: ChargebackBanIdentifierType;
  value: string;
}> {
  const out: Array<{
    signalId: string;
    partnerId: string;
    type: ChargebackBanIdentifierType;
    value: string;
  }> = [];

  const push = (type: ChargebackBanIdentifierType, value: string | null) => {
    if (value) out.push({ signalId, partnerId, type, value });
  };

  for (const email of entry.identifiers.emails ?? []) {
    push('EMAIL', canonicalizeEmail(email));
  }
  for (const phone of entry.identifiers.phones ?? []) {
    push('PHONE', canonicalizePhone(phone));
  }
  for (const fp of entry.identifiers.card_fingerprints ?? []) {
    push('CARD_FINGERPRINT', canonicalizeFingerprint(fp));
  }
  for (const name of entry.identifiers.billing_names ?? []) {
    push('BILLING_NAME', canonicalizeName(name));
  }
  for (const addr of entry.identifiers.billing_addresses ?? []) {
    push('BILLING_ADDRESS_KEY', canonicalizeAddressKey(addr));
  }
  for (const ip of entry.identifiers.last_known_ips ?? []) {
    push('IP', canonicalizeIp(ip));
  }
  for (const dfp of entry.identifiers.device_fingerprints ?? []) {
    push('DEVICE_FINGERPRINT', canonicalizeFingerprint(dfp));
  }
  return out;
}
