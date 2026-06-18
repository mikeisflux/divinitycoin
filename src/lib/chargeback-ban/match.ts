// lib/chargeback-ban/match.ts
// Run the per-attempt match against the cached ban list. Single DB
// round-trip: build all candidate (type, value) pairs from the
// attempt, then one `WHERE (type, value) IN (...)` SELECT against
// ChargebackBanIdentifier, indexed on (partnerId, type, value).

import { prisma } from '@/lib/db';
import { ChargebackBanIdentifierType } from '@prisma/client';
import {
  canonicalizeEmail,
  canonicalizePhone,
  canonicalizeName,
  canonicalizeAddressKey,
  canonicalizeFingerprint,
  canonicalizeIp,
} from './canonicalize';

export interface PrefilterAttempt {
  email?: string | null;
  phone?: string | null;
  billingName?: string | null;
  billingAddress?: {
    line1?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  cardFingerprint?: string | null;
  ipAddress?: string | null;
  deviceFingerprint?: string | null;
}

export interface MatchResult {
  // Identifier types that matched as a hard-block signal.
  hardBlockMatches: ChargebackBanIdentifierType[];
  // Identifier types that matched as a soft-flag signal.
  softFlagMatches: ChargebackBanIdentifierType[];
  // Deduplicated source_user_ids that the matched identifiers point at.
  matchedSourceUserIds: string[];
  // Raw identifier rows that matched, for audit.
  matchedIdentifiers: Array<{
    type: ChargebackBanIdentifierType;
    value: string;
    sourceUserId: string;
  }>;
}

type CandidatePair = { type: ChargebackBanIdentifierType; value: string };

function buildCandidates(attempt: PrefilterAttempt): CandidatePair[] {
  const pairs: CandidatePair[] = [];
  const email = canonicalizeEmail(attempt.email);
  if (email) pairs.push({ type: 'EMAIL', value: email });

  const phone = canonicalizePhone(attempt.phone);
  if (phone) pairs.push({ type: 'PHONE', value: phone });

  const fp = canonicalizeFingerprint(attempt.cardFingerprint);
  if (fp) pairs.push({ type: 'CARD_FINGERPRINT', value: fp });

  const name = canonicalizeName(attempt.billingName);
  if (name) pairs.push({ type: 'BILLING_NAME', value: name });

  const addrKey = canonicalizeAddressKey(attempt.billingAddress);
  if (addrKey) pairs.push({ type: 'BILLING_ADDRESS_KEY', value: addrKey });

  const ip = canonicalizeIp(attempt.ipAddress);
  if (ip) pairs.push({ type: 'IP', value: ip });

  const dfp = canonicalizeFingerprint(attempt.deviceFingerprint);
  if (dfp) pairs.push({ type: 'DEVICE_FINGERPRINT', value: dfp });

  return pairs;
}

/**
 * Match an attempt against the live ban list for a single partner.
 * Suppresses IP matches against admin-curated CGNAT allowlist IPs.
 * Active-only — rows with removedAt set are ignored.
 */
export async function runMatcher(
  partnerId: string,
  attempt: PrefilterAttempt,
): Promise<MatchResult> {
  const candidates = buildCandidates(attempt);
  if (candidates.length === 0) {
    return {
      hardBlockMatches: [],
      softFlagMatches: [],
      matchedSourceUserIds: [],
      matchedIdentifiers: [],
    };
  }

  // One round-trip: an OR of (type, value) pairs. Indexed on
  // (partnerId, type, value).
  const rows = await prisma.chargebackBanIdentifier.findMany({
    where: {
      partnerId,
      OR: candidates.map((c) => ({ type: c.type, value: c.value })),
      signal: { removedAt: null },
    },
    select: {
      type: true,
      value: true,
      signal: { select: { sourceUserId: true } },
    },
  });

  // Suppress IP matches against the CGNAT allowlist.
  let ipAllowlist: Set<string> = new Set();
  const ipHits = rows.filter((r) => r.type === 'IP');
  if (ipHits.length > 0) {
    const cgnat = await prisma.chargebackBanCgnatIp.findMany({
      where: { ipAddress: { in: ipHits.map((r) => r.value) } },
      select: { ipAddress: true },
    });
    ipAllowlist = new Set(cgnat.map((r) => r.ipAddress));
  }

  const filtered = rows.filter((r) => !(r.type === 'IP' && ipAllowlist.has(r.value)));

  const matchedIdentifiers = filtered.map((r) => ({
    type: r.type,
    value: r.value,
    sourceUserId: r.signal.sourceUserId,
  }));

  const matchedTypesSet = new Set<ChargebackBanIdentifierType>(matchedIdentifiers.map((r) => r.type));

  // Per the spec's match table.
  const hardBlockTypes = new Set<ChargebackBanIdentifierType>([
    'CARD_FINGERPRINT',
    'EMAIL',
    'PHONE',
    'DEVICE_FINGERPRINT',
  ]);
  const softFlagTypes = new Set<ChargebackBanIdentifierType>(['IP']);

  const hardBlockMatches: ChargebackBanIdentifierType[] = [];
  const softFlagMatches: ChargebackBanIdentifierType[] = [];
  for (const t of matchedTypesSet) {
    if (hardBlockTypes.has(t)) hardBlockMatches.push(t);
    else if (softFlagTypes.has(t)) softFlagMatches.push(t);
  }

  // billing_name + billing_address → hard block; billing_address only → soft flag.
  const hasName = matchedTypesSet.has('BILLING_NAME');
  const hasAddr = matchedTypesSet.has('BILLING_ADDRESS_KEY');
  if (hasName && hasAddr) {
    hardBlockMatches.push('BILLING_NAME');
    hardBlockMatches.push('BILLING_ADDRESS_KEY');
  } else if (hasAddr) {
    softFlagMatches.push('BILLING_ADDRESS_KEY');
  }

  const sourceUserIds = Array.from(new Set(matchedIdentifiers.map((r) => r.sourceUserId)));

  return {
    hardBlockMatches: Array.from(new Set(hardBlockMatches)),
    softFlagMatches: Array.from(new Set(softFlagMatches)),
    matchedSourceUserIds: sourceUserIds,
    matchedIdentifiers,
  };
}
