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
export async function syncBanFeed(args: {
  partnerId: string;
  feedUrl: string;
  feedToken: string;
}): Promise<SyncResult> {
  const { partnerId, feedUrl, feedToken } = args;
  const run = await prisma.chargebackBanFeedSync.create({
    data: { partnerId },
  });

  try {
    const res = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${feedToken}`,
        Accept: 'application/json',
      },
      // Standard 10-second budget — the feed runs every 5 minutes so
      // a slow response shouldn't block forever.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Feed responded ${res.status}: ${errText.slice(0, 200)}`);
    }
    const body = (await res.json()) as FeedResponse;
    if (!body || !Array.isArray(body.signals)) {
      throw new Error('Feed response missing signals[]');
    }

    const feedTimestamp = body.updated_at ? new Date(body.updated_at) : new Date();

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
    logger.error('Chargeback ban feed sync failed', { partnerId, error: msg });
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
