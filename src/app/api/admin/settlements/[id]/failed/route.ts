// app/api/admin/settlements/[id]/failed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { markSettlementFailed, getSettlementDetail } from '@/lib/settlements';
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
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const settlement = await getSettlementDetail(id);

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== 'PROCESSING') {
      return NextResponse.json({ error: 'Settlement is not processing' }, { status: 400 });
    }

    await markSettlementFailed(id, reason);

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.failed',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({ partnerId: settlement.partnerId, amount: settlement.netAmount, reason }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark settlement as failed:', error);
    return NextResponse.json({ error: 'Failed to mark settlement as failed' }, { status: 500 });
  }
}
