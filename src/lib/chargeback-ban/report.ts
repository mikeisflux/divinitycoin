// lib/chargeback-ban/report.ts
// POST to the partner's /chargeback-ban-blocked webhook so the partner
// can audit firing rate, detect retry-spam from banned users, and
// pre-emptively lock the new account on their side.

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ChargebackBanIdentifierType } from '@prisma/client';

interface ReportPayload {
  blocked_at: string;
  attempted_amount_cents: number | null;
  attempted_currency: string | null;
  matched_signals: string[];
  source_user_ids: string[];
  attempted_email: string | null;
  attempted_ip: string | null;
  attempted_card_last4: string | null;
  attempted_card_brand: string | null;
  attempted_billing_postal_code: string | null;
}

/**
 * Best-effort POST. Failures are logged on the ChargebackBanMatch row
 * so the admin UI can surface "report unreported" matches and re-send.
 * Never throws — the prefilter decision has already been returned to
 * the partner by the time we get here.
 */
export async function reportBlockedAttempt(args: {
  matchId: string;
  reportUrl: string;
  reportToken: string;
  matchedTypes: ChargebackBanIdentifierType[];
  sourceUserIds: string[];
  attempt: {
    amountCents?: number | null;
    currency?: string | null;
    email?: string | null;
    ip?: string | null;
    cardLast4?: string | null;
    cardBrand?: string | null;
    billingPostal?: string | null;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const { matchId, reportUrl, reportToken, matchedTypes, sourceUserIds, attempt } = args;
  const payload: ReportPayload = {
    blocked_at: new Date().toISOString(),
    attempted_amount_cents: attempt.amountCents ?? null,
    attempted_currency: attempt.currency ?? null,
    matched_signals: matchedTypes.map((t) => t.toLowerCase()),
    source_user_ids: sourceUserIds,
    attempted_email: attempt.email ?? null,
    attempted_ip: attempt.ip ?? null,
    attempted_card_last4: attempt.cardLast4 ?? null,
    attempted_card_brand: attempt.cardBrand ?? null,
    attempted_billing_postal_code: attempt.billingPostal ?? null,
  };

  try {
    const res = await fetch(reportUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${reportToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const errMsg = `Report-back ${res.status}: ${text.slice(0, 200)}`;
      await prisma.chargebackBanMatch.update({
        where: { id: matchId },
        data: { reportError: errMsg },
      });
      logger.warn('Chargeback ban report-back failed', { matchId, error: errMsg });
      return { ok: false, error: errMsg };
    }
    await prisma.chargebackBanMatch.update({
      where: { id: matchId },
      data: { reportedAt: new Date(), reportError: null },
    });
    return { ok: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await prisma.chargebackBanMatch
      .update({ where: { id: matchId }, data: { reportError: errMsg } })
      .catch(() => { /* best-effort */ });
    logger.warn('Chargeback ban report-back threw', { matchId, error: errMsg });
    return { ok: false, error: errMsg };
  }
}
