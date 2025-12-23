// app/api/partners/settlements/route.ts
// Partner settlements API - list and summary

export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { getSettlements, getSettlementStats } from '@/lib/settlements';
import { SettlementStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SettlementStatus | null;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parse dates if provided
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    // Get settlements for this partner only
    const [settlementsResult, stats] = await Promise.all([
      getSettlements({
        partnerId: partner.partnerId,
        status: status || undefined,
        from,
        to,
        limit,
        offset,
      }),
      getSettlementStats(partner.partnerId),
    ]);

    return NextResponse.json({
      settlements: settlementsResult.settlements.map(s => ({
        id: s.id,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        grossAmount: s.grossAmount,
        partnerFee: s.partnerFee,
        netAmount: s.netAmount,
        captureCount: s.captureCount,
        status: s.status,
        paymentMethod: s.paymentMethod,
        paymentRef: s.paymentRef,
        paidAt: s.paidAt?.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      total: settlementsResult.total,
      stats: {
        pendingAmount: stats.totalPending,
        pendingCount: stats.pendingCount,
        paidThisMonth: stats.totalPaidThisMonth,
        paidCountThisMonth: stats.paidCountThisMonth,
        paidThisYear: stats.totalPaidThisYear,
        paidCountThisYear: stats.paidCountThisYear,
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < settlementsResult.total,
      },
    });
  } catch (error) {
    logger.apiError('Failed to fetch settlements:', error);
    return NextResponse.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}
