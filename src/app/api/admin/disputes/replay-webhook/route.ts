// app/api/admin/disputes/replay-webhook/route.ts
// Re-fire dispute.created to the partner for disputes that already exist in
// Stripe. Covers the backfill case — disputes raised before the event was
// wired up, which the partner's platform never learned about — and any
// delivery that failed after its retries were exhausted.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { getStripeClient } from '@/lib/stripe';
import { notifyPartnerOfDispute } from '@/lib/partner/dispute-webhook';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized || !admin) return response;

  try {
    const body = await request.json().catch(() => ({}));

    // Accept one or many, because a backfill is usually a short list.
    const rawIds: unknown = body?.paymentIntentIds ?? body?.paymentIntentId;
    const paymentIntentIds = (Array.isArray(rawIds) ? rawIds : [rawIds])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());

    if (paymentIntentIds.length === 0) {
      return NextResponse.json(
        { error: 'paymentIntentId (or paymentIntentIds[]) is required' },
        { status: 400 },
      );
    }
    if (paymentIntentIds.length > 25) {
      return NextResponse.json(
        { error: 'At most 25 payment intents per call' },
        { status: 400 },
      );
    }

    const stripe = await getStripeClient();
    const results = [];

    for (const paymentIntentId of paymentIntentIds) {
      // Stripe is the source of truth for what was actually disputed — we
      // don't keep our own copy of the dispute object, and replaying from a
      // stale local record could report a status that has since changed.
      let disputes;
      try {
        disputes = await stripe.disputes.list({ payment_intent: paymentIntentId, limit: 10 });
      } catch (error) {
        results.push({
          paymentIntentId,
          ok: false,
          error: error instanceof Error ? error.message : 'Stripe lookup failed',
        });
        continue;
      }

      if (disputes.data.length === 0) {
        results.push({ paymentIntentId, ok: false, error: 'No dispute found for this payment intent' });
        continue;
      }

      for (const dispute of disputes.data) {
        const outcome = await notifyPartnerOfDispute(dispute);
        results.push({
          paymentIntentId,
          disputeId: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
          ok: outcome.delivered,
          ...(outcome.delivered ? {} : { error: outcome.reason }),
        });
      }
    }

    await logAdminAction(
      admin.id,
      'DISPUTE_WEBHOOK_REPLAY',
      'dispute',
      paymentIntentIds.join(','),
      { requested: paymentIntentIds.length, delivered: results.filter((r) => r.ok).length },
      getClientIP(request),
      getUserAgent(request),
    );

    return NextResponse.json({
      success: true,
      delivered: results.filter((r) => r.ok).length,
      total: results.length,
      results,
    });
  } catch (error) {
    logger.apiError('/api/admin/disputes/replay-webhook', error);
    return NextResponse.json({ error: 'Replay failed' }, { status: 500 });
  }
}
