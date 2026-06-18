// lib/chargeback-ban/prefilter.ts
// Entry point used by /internal route handlers. Resolves config,
// short-circuits when disabled or when the partner is not subscribed,
// runs the matcher, writes a ChargebackBanMatch audit row, and (if a
// hard match in enforce mode) fires the report-back webhook.
//
// Returns a decision telling the caller whether to reject the request.

import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { runMatcher, PrefilterAttempt } from './match';
import { reportBlockedAttempt } from './report';
import { ChargebackBanDecision } from '@prisma/client';

export type PrefilterMode = 'off' | 'log_only' | 'enforce';

export interface PrefilterDecision {
  // What the caller should DO right now.
  decision: ChargebackBanDecision;
  // Identifier types that matched as hard-block (lowercased strings
  // suitable for log surfaces — never returned to the end user).
  matchedSignals: string[];
  softFlags: string[];
  sourceUserIds: string[];
  matchId?: string;
}

interface PrefilterInput {
  partnerId: string;
  attemptedAction: 'create-payment-intent' | 'charge-saved-payment-method';
  attempt: PrefilterAttempt;
  amountCents?: number;
  currency?: string;
  platformUserId?: string;
  pledgeId?: string;
  cardLast4?: string | null;
  cardBrand?: string | null;
  billingPostal?: string | null;
}

interface ResolvedConfig {
  mode: PrefilterMode;
  partnerSlugs: Set<string>;
  reportUrl: string;
  reportToken: string;
}

async function resolveConfig(): Promise<ResolvedConfig> {
  const rawMode = (await getConfig('CHARGEBACK_BAN_MODE', 'log_only')).toLowerCase();
  const mode: PrefilterMode =
    rawMode === 'off' || rawMode === 'enforce' ? rawMode : 'log_only';

  const slugs = (await getConfig('CHARGEBACK_BAN_PARTNER_SLUGS', 'indiecrowdfund'))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    mode,
    partnerSlugs: new Set(slugs),
    reportUrl: await getConfig(
      'CHARGEBACK_BAN_REPORT_URL',
      'https://indiecrowdfund.com/api/divinitycoin/chargeback-ban-blocked',
    ),
    reportToken: await getConfig('CHARGEBACK_BAN_REPORT_TOKEN', ''),
  };
}

/**
 * Run the prefilter for one inbound attempt. The caller MUST honor the
 * returned decision when it's HARD_BLOCK.
 */
export async function runPrefilter(input: PrefilterInput): Promise<PrefilterDecision> {
  const allowAll: PrefilterDecision = {
    decision: 'ALLOW',
    matchedSignals: [],
    softFlags: [],
    sourceUserIds: [],
  };

  let cfg: ResolvedConfig;
  try {
    cfg = await resolveConfig();
  } catch (err) {
    logger.error('Prefilter config resolution failed', { err });
    return allowAll;
  }
  if (cfg.mode === 'off') return allowAll;

  // Only run for partners that are subscribed to the ban-prefilter.
  const partner = await prisma.partner.findUnique({
    where: { id: input.partnerId },
    select: { slug: true },
  });
  if (!partner || !cfg.partnerSlugs.has(partner.slug.toLowerCase())) {
    return allowAll;
  }

  let result;
  try {
    result = await runMatcher(input.partnerId, input.attempt);
  } catch (err) {
    logger.error('Prefilter matcher threw — failing open', { err, partnerId: input.partnerId });
    return allowAll;
  }

  const hasHard = result.hardBlockMatches.length > 0;
  const hasSoft = result.softFlagMatches.length > 0;
  if (!hasHard && !hasSoft) return allowAll;

  const intended: ChargebackBanDecision = hasHard ? 'HARD_BLOCK' : 'SOFT_FLAG';
  const actual: ChargebackBanDecision =
    cfg.mode === 'log_only' ? 'LOGGED_ONLY' : intended;

  // Latest feed timestamp (for staleness debug only).
  const lastSync = await prisma.chargebackBanFeedSync
    .findFirst({
      where: { partnerId: input.partnerId, ok: true, feedTimestamp: { not: null } },
      orderBy: { startedAt: 'desc' },
      select: { feedTimestamp: true },
    })
    .catch(() => null);

  const matchedSignalLabels = [
    ...result.hardBlockMatches.map((t) => t.toLowerCase()),
    ...result.softFlagMatches.map((t) => t.toLowerCase()),
  ];

  const match = await prisma.chargebackBanMatch.create({
    data: {
      partnerId: input.partnerId,
      decision: actual,
      intendedDecision: intended,
      matchedSignals: matchedSignalLabels,
      sourceUserIds: result.matchedSourceUserIds,
      attemptedAction: input.attemptedAction,
      attemptedAmountCents: input.amountCents ?? null,
      attemptedCurrency: input.currency ?? null,
      attemptedEmail: input.attempt.email ?? null,
      attemptedPhone: input.attempt.phone ?? null,
      attemptedIp: input.attempt.ipAddress ?? null,
      attemptedCardFingerprint: input.attempt.cardFingerprint ?? null,
      attemptedCardLast4: input.cardLast4 ?? null,
      attemptedCardBrand: input.cardBrand ?? null,
      attemptedBillingPostal: input.billingPostal ?? null,
      attemptedPlatformUserId: input.platformUserId ?? null,
      attemptedPledgeId: input.pledgeId ?? null,
      feedTimestamp: lastSync?.feedTimestamp ?? null,
    },
  });

  logger.warn('Chargeback ban prefilter matched', {
    partnerId: input.partnerId,
    decision: actual,
    intended,
    matchedSignals: matchedSignalLabels,
    sourceUserIds: result.matchedSourceUserIds,
    action: input.attemptedAction,
    platformUserId: input.platformUserId,
    pledgeId: input.pledgeId,
  });

  // Fire the report-back webhook for any hard-match, even in
  // log_only mode — the partner asked us to surface attempts so
  // their cron can widen the ban net. We don't await it inside the
  // critical path so the user-facing response is not delayed; the
  // void is intentional.
  if (hasHard && cfg.reportToken && cfg.reportUrl) {
    void reportBlockedAttempt({
      matchId: match.id,
      reportUrl: cfg.reportUrl,
      reportToken: cfg.reportToken,
      matchedTypes: result.hardBlockMatches,
      sourceUserIds: result.matchedSourceUserIds,
      attempt: {
        amountCents: input.amountCents,
        currency: input.currency,
        email: input.attempt.email,
        ip: input.attempt.ipAddress,
        cardLast4: input.cardLast4,
        cardBrand: input.cardBrand,
        billingPostal: input.billingPostal,
      },
    });
  }

  return {
    decision: actual,
    matchedSignals: result.hardBlockMatches.map((t) => t.toLowerCase()),
    softFlags: result.softFlagMatches.map((t) => t.toLowerCase()),
    sourceUserIds: result.matchedSourceUserIds,
    matchId: match.id,
  };
}

/**
 * Standard error body the partner sees on a hard-block. The
 * matched_signals field is the only place we surface the match types,
 * and per the spec it should NOT be in the human-facing message string.
 */
export const HARD_BLOCK_RESPONSE = {
  success: false,
  error: 'Payment blocked: account associated with prior chargeback.',
  code: 'chargeback_ban_match' as const,
};
