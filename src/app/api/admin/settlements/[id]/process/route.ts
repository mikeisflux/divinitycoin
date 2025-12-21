// app/api/admin/settlements/[id]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { processSettlement, getSettlementDetail } from '@/lib/settlements';
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
    const settlement = await getSettlementDetail(id);

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (!['APPROVED', 'FAILED'].includes(settlement.status)) {
      return NextResponse.json({ error: 'Settlement cannot be processed from current status' }, { status: 400 });
    }

    await processSettlement(id);

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.process',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({ partnerId: settlement.partnerId, amount: settlement.netAmount }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process settlement:', error);
    return NextResponse.json({ error: 'Failed to process settlement' }, { status: 500 });
  }
}
