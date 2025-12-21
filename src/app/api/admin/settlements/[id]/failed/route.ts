// app/api/admin/settlements/[id]/failed/route.ts
// Mark settlement as failed

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { SettlementStatus } from '@prisma/client';
import { notifySettlementStatusChange } from '@/lib/settlements/webhooks';
import { sendPaymentFailedEmail } from '@/lib/settlements/emails';

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
    const { reason } = body;

    const settlement = await prisma.partnerSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (settlement.status !== SettlementStatus.PROCESSING) {
      return NextResponse.json({ error: `Cannot mark as failed with status: ${settlement.status}` }, { status: 400 });
    }

    // Add timestamp to notes
    const timestamp = new Date().toISOString();
    const failureNote = `[${timestamp}] Payment failed: ${reason || 'No reason provided'}`;
    const updatedNotes = settlement.adminNotes
      ? `${settlement.adminNotes}\n${failureNote}`
      : failureNote;

    // Update settlement
    await prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: SettlementStatus.FAILED,
        adminNotes: updatedNotes,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'settlement.failed',
        resource: 'PartnerSettlement',
        resourceId: id,
        details: JSON.stringify({
          reason,
          netAmount: settlement.netAmount.toString(),
        }),
      },
    });

    // Send webhook and email
    await Promise.all([
      notifySettlementStatusChange(id, SettlementStatus.FAILED),
      sendPaymentFailedEmail(id, reason),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Settlement marked as failed',
    });
  } catch (error) {
    console.error('Failed to mark settlement as failed:', error);
    return NextResponse.json({ error: 'Failed to mark settlement as failed' }, { status: 500 });
  }
}
