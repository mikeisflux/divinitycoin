// app/api/cron/expire-checkout-sessions/route.ts
// Expires hosted checkout sessions whose expiresAt has passed and fires the
// partner's checkout.expired for each.
//
// Call every 5 minutes:
//   curl -X POST https://divinitycoin.com/api/cron/expire-checkout-sessions?secret=...
//
// Expiry used to be entirely lazy — a session only moved off PENDING when
// something happened to read it. A session abandoned on the 19th therefore
// sat PENDING until a partner's reconciliation call touched it days later,
// at which point checkout.expired arrived as a surprise referencing a
// pledge they had long since settled by hand. Sweeping them on a timer
// means the event lands while it still means something.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { fireCheckoutWebhookIfNeeded } from '@/lib/checkout/webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Bounded so one run can't sit on the connection pool for minutes if a
// large backlog has built up; the next tick picks up the remainder.
const BATCH_LIMIT = 200;

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
    const stale = await prisma.checkoutSession.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true, sessionToken: true, partnerId: true },
      orderBy: { expiresAt: 'asc' },
      take: BATCH_LIMIT,
    });

    let expired = 0;
    for (const session of stale) {
      // Re-check status inside the write so a session completed between the
      // read above and here is not walked backwards to EXPIRED.
      const updated = await prisma.checkoutSession.updateMany({
        where: { id: session.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      if (updated.count === 0) continue;
      expired += 1;
      await fireCheckoutWebhookIfNeeded(session.id);
    }

    if (expired > 0) {
      logger.info('Expired stale checkout sessions', {
        expired,
        scanned: stale.length,
        more: stale.length === BATCH_LIMIT,
      });
    }

    return NextResponse.json({
      success: true,
      scanned: stale.length,
      expired,
      more: stale.length === BATCH_LIMIT,
    });
  } catch (error) {
    logger.error('Failed to expire stale checkout sessions', { error });
    return NextResponse.json(
      { error: 'Failed to expire stale checkout sessions' },
      { status: 500 },
    );
  }
}
