// app/api/cron/reconcile-partner-payments/route.ts
// Settles partner payment records still PENDING against the processor, and
// replays fulfilment for any whose intent succeeded but whose webhook was
// lost. Also takes explicit ids for a targeted replay.
//
// Sweep, every 15 minutes:
//   curl -X POST https://divinitycoin.com/api/cron/reconcile-partner-payments?secret=...
//
// Targeted replay of specific intents:
//   curl -X POST .../api/cron/reconcile-partner-payments?secret=... \
//        -H 'Content-Type: application/json' \
//        -d '{"paymentIntentIds":["pi_..."]}'
//
// Replay is safe on something already fulfilled; see
// lib/stripe/payment-succeeded.ts.

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import {
  reconcileStuckPartnerPayments,
  replayPaymentIntentSucceeded,
} from '@/lib/stripe/payment-succeeded';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authorizeCron(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = await getConfig('CRON_SECRET', '');
  if (!cronSecret) return null;
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('secret');
  const fromHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (fromQuery !== cronSecret && fromHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const unauth = await authorizeCron(request);
  if (unauth) return unauth;

  try {
    const body = await request.json().catch(() => ({}));
    const raw: unknown = body?.paymentIntentIds;
    const ids = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string' && /^pi_[A-Za-z0-9]+$/.test(x)).slice(0, 50)
      : [];

    if (ids.length > 0) {
      const results = [];
      for (const id of ids) {
        try {
          results.push(await replayPaymentIntentSucceeded(id));
        } catch (error) {
          logger.error('Targeted replay failed', { paymentIntentId: id, error });
          results.push({ paymentIntentId: id, liveStatus: 'error', replayed: false });
        }
      }
      return NextResponse.json({ success: true, mode: 'targeted', results });
    }

    const summary = await reconcileStuckPartnerPayments();
    if (summary.replayed > 0 || summary.failed > 0) {
      logger.info('Reconciled stuck partner payments', {
        scanned: summary.scanned,
        replayed: summary.replayed,
        failed: summary.failed,
        more: summary.more,
      });
    }
    return NextResponse.json({ success: true, mode: 'sweep', ...summary });
  } catch (error) {
    logger.error('Partner payment reconcile failed', { error });
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}
