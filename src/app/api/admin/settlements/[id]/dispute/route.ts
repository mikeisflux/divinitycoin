// app/api/admin/settlements/[id]/dispute/route.ts
// Dispute a settlement

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { SettlementStatus } from '@prisma/client';
import { notifySettlementStatusChange } from '@/lib/settlements/webhooks';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(admin.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 });
    }

    const settlement = await prisma.partnerSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    // Can only dispute from PENDING
    if (settlement.status !== SettlementStatus.PENDING) {
      return NextResponse.json({ error: `Cannot dispute settlement with status: ${settlement.status}` }, { status: 400 });
    }

    // Update settlement
    await prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: SettlementStatus.DISPUTED,
        disputeReason: reason,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.dispute',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({
          reason,
          netAmount: settlement.netAmount.toString(),
        }),
      },
    });

    // Send webhook
    await notifySettlementStatusChange(id, SettlementStatus.DISPUTED);

    return NextResponse.json({
      success: true,
      message: 'Settlement disputed',
    });
  } catch (error) {
    console.error('Failed to dispute settlement:', error);
    return NextResponse.json({ error: 'Failed to dispute settlement' }, { status: 500 });
  }
}
