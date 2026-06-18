// app/api/admin/chargeback-bans/matches/route.ts
// List recent prefilter matches — both real blocks and would-have-blocked.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ChargebackBanDecision } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const decision = searchParams.get('decision') as ChargebackBanDecision | null;
    const limit = Math.min(Number(searchParams.get('limit') ?? '200'), 500);

    const matches = await prisma.chargebackBanMatch.findMany({
      where: decision ? { decision } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      matches: matches.map((m) => ({
        id: m.id,
        partnerId: m.partnerId,
        decision: m.decision,
        intendedDecision: m.intendedDecision,
        matchedSignals: m.matchedSignals,
        sourceUserIds: m.sourceUserIds,
        attemptedAction: m.attemptedAction,
        attemptedAmountCents: m.attemptedAmountCents,
        attemptedCurrency: m.attemptedCurrency,
        attemptedEmail: m.attemptedEmail,
        attemptedIp: m.attemptedIp,
        attemptedCardLast4: m.attemptedCardLast4,
        attemptedCardBrand: m.attemptedCardBrand,
        attemptedBillingPostal: m.attemptedBillingPostal,
        attemptedPlatformUserId: m.attemptedPlatformUserId,
        attemptedPledgeId: m.attemptedPledgeId,
        feedTimestamp: m.feedTimestamp?.toISOString() ?? null,
        reportedAt: m.reportedAt?.toISOString() ?? null,
        reportError: m.reportError,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/matches', error);
    return NextResponse.json({ error: 'Failed to load matches' }, { status: 500 });
  }
}
