// app/api/admin/settlements/[id]/paid/route.ts
// Mark settlement as paid

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { SettlementStatus } from '@prisma/client';
import { notifySettlementStatusChange } from '@/lib/settlements/webhooks';
import { sendSettlementPaidEmail } from '@/lib/settlements/emails';

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
    const body = await request.json().catch(() => ({}));
    const { paymentRef } = body;

    const settlement = await prisma.partnerSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== SettlementStatus.PROCESSING) {
      return NextResponse.json({ error: `Cannot mark as paid with status: ${settlement.status}` }, { status: 400 });
    }

    // Update settlement
    await prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: SettlementStatus.PAID,
        paymentRef: paymentRef || settlement.paymentRef,
        paidAt: new Date(),
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.paid',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({
          paymentRef: paymentRef || settlement.paymentRef,
          netAmount: settlement.netAmount.toString(),
        }),
      },
    });

    // Send webhook and email
    await Promise.all([
      notifySettlementStatusChange(id, SettlementStatus.PAID),
      sendSettlementPaidEmail(id),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Settlement marked as paid',
    });
  } catch (error) {
    console.error('Failed to mark settlement as paid:', error);
    return NextResponse.json({ error: 'Failed to mark settlement as paid' }, { status: 500 });
  }
}
