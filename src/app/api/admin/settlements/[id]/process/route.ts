// app/api/admin/settlements/[id]/process/route.ts
// Mark settlement as processing

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
    const { paymentRef } = body;

    const settlement = await prisma.partnerSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== SettlementStatus.APPROVED) {
      return NextResponse.json({ error: `Cannot process settlement with status: ${settlement.status}` }, { status: 400 });
    }

    // Update settlement
    await prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: SettlementStatus.PROCESSING,
        paymentRef: paymentRef || settlement.paymentRef,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.process',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({
          paymentRef,
          netAmount: settlement.netAmount.toString(),
        }),
      },
    });

    // Send webhook
    await notifySettlementStatusChange(id, SettlementStatus.PROCESSING);

    return NextResponse.json({
      success: true,
      message: 'Settlement marked as processing',
    });
  } catch (error) {
    console.error('Failed to process settlement:', error);
    return NextResponse.json({ error: 'Failed to process settlement' }, { status: 500 });
  }
}
