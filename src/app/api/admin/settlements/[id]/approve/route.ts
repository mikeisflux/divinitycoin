// app/api/admin/settlements/[id]/approve/route.ts
// Approve a settlement

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

    const settlement = await prisma.partnerSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    // Can only approve from PENDING, FAILED, or DISPUTED states
    if (!['PENDING', 'FAILED', 'DISPUTED'].includes(settlement.status)) {
      return NextResponse.json({ error: `Cannot approve settlement with status: ${settlement.status}` }, { status: 400 });
    }

    // Update settlement
    await prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: SettlementStatus.APPROVED,
        approvedBy: admin.id,
        approvedAt: new Date(),
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.approve',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({
          previousStatus: settlement.status,
          netAmount: settlement.netAmount.toString(),
        }),
      },
    });

    // Send webhook
    await notifySettlementStatusChange(id, SettlementStatus.APPROVED);

    return NextResponse.json({
      success: true,
      message: 'Settlement approved',
    });
  } catch (error) {
    console.error('Failed to approve settlement:', error);
    return NextResponse.json({ error: 'Failed to approve settlement' }, { status: 500 });
  }
}
