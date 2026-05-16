// app/api/checkout/[sessionToken]/status/route.ts
// Lightweight read-only status endpoint for the iframe-mode polling
// fallback. Returns the current persisted state of a checkout session
// without hitting the processor — the heavy lifting (Stripe round-trip,
// terminal-state transition, webhook firing) already happens inside the
// popup's /complete call. The iframe just needs to notice it.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function appendSessionId(url: string, sessionToken: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('session_id', sessionToken);
    return u.toString();
  } catch {
    return url;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionToken: string } },
) {
  try {
    const session = await prisma.checkoutSession.findUnique({
      where: { sessionToken: params.sessionToken },
      select: {
        status: true,
        returnUrl: true,
        cancelUrl: true,
        sessionToken: true,
      },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const target =
      session.status === 'COMPLETE'
        ? session.returnUrl
        : (session.cancelUrl ?? session.returnUrl);

    return NextResponse.json({
      status: session.status.toLowerCase(),
      redirectUrl: target ? appendSessionId(target, session.sessionToken) : null,
    });
  } catch (error) {
    logger.error('Hosted checkout: status endpoint failed', {
      sessionToken: params.sessionToken,
      error,
    });
    return NextResponse.json({ error: 'Failed to read status' }, { status: 500 });
  }
}
