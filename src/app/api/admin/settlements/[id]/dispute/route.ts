// app/api/admin/settlements/[id]/dispute/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { disputeSettlement, getSettlementDetail } from '@/lib/settlements';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 });
    }

    const settlement = await getSettlementDetail(id);

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (!['PENDING', 'APPROVED'].includes(settlement.status)) {
      return NextResponse.json({ error: 'Settlement cannot be disputed from current status' }, { status: 400 });
    }

    await disputeSettlement(id, reason);

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.dispute',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({ partnerId: settlement.partnerId, amount: settlement.netAmount, reason }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Failed to dispute settlement:', error);
    return NextResponse.json({ error: 'Failed to dispute settlement' }, { status: 500 });
  }
}
