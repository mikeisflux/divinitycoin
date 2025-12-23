// app/api/partners/settlements/[id]/route.ts
// Partner settlement detail API

export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { getSettlementDetail } from '@/lib/settlements';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const settlement = await getSettlementDetail(id);

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    // Verify this settlement belongs to the requesting partner
    if (settlement.partnerId !== partner.partnerId) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    return NextResponse.json({
      settlement: {
        id: settlement.id,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        grossAmount: settlement.grossAmount,
        partnerFee: settlement.partnerFee,
        feePercentage: settlement.feePercentage,
        netAmount: settlement.netAmount,
        currency: settlement.currency,
        captureCount: settlement.captureCount,
        status: settlement.status,
        paymentMethod: settlement.paymentMethod,
        paymentRef: settlement.paymentRef,
        paidAt: settlement.paidAt?.toISOString(),
        createdAt: settlement.createdAt.toISOString(),
        captures: settlement.captures.map(c => ({
          id: c.id,
          holdId: c.holdId,
          creatorId: c.creatorId,
          creatorEmail: c.creatorEmail,
          projectId: c.projectId,
          projectName: c.projectName,
          amount: c.amount,
          capturedAt: c.capturedAt.toISOString(),
        })),
        byCreator: settlement.byCreator,
        byProject: settlement.byProject,
      },
    });
  } catch (error) {
    logger.apiError('Failed to fetch settlement:', error);
    return NextResponse.json({ error: 'Failed to fetch settlement' }, { status: 500 });
  }
}
