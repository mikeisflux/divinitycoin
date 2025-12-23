// app/api/admin/settlements/[id]/paid/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { markSettlementPaid, getSettlementDetail } from '@/lib/settlements';
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
    const { paymentRef } = body;

    if (!paymentRef) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    const settlement = await getSettlementDetail(id);

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== 'PROCESSING') {
      return NextResponse.json({ error: 'Settlement is not processing' }, { status: 400 });
    }

    await markSettlementPaid(id, paymentRef);

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.paid',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({ partnerId: settlement.partnerId, amount: settlement.netAmount, paymentRef }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Failed to mark settlement as paid:', error);
    return NextResponse.json({ error: 'Failed to mark settlement as paid' }, { status: 500 });
  }
}
