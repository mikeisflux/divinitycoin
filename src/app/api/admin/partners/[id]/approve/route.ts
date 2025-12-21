// app/api/admin/partners/[id]/approve/route.ts
// Approve partner and send setup link

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminFromRequest();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and ADMIN can approve partners
    if (!['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Partner is already active' }, { status: 400 });
    }

    // Generate setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update partner
    const settings = (partner.settings as any) || {};
    const updatedSettings = {
      ...settings,
      setupToken,
      setupTokenExpires: setupTokenExpires.toISOString(),
      approvedBy: admin.id,
      approvedAt: new Date().toISOString(),
    };

    await prisma.partner.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        settings: updatedSettings,
      },
    });

    // Generate setup URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const setupUrl = `${baseUrl}/partners/setup?token=${setupToken}`;

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'partner.approve',
        resource: 'Partner',
        resourceId: params.id,
        details: JSON.stringify({
          partnerName: partner.name,
          contactEmail: partner.contactEmail,
        }),
      },
    });

    // In production, send email to partner
    // await sendPartnerSetupEmail(partner.contactEmail, setupUrl);

    return NextResponse.json({
      success: true,
      setupUrl,
      message: 'Partner approved. Setup link generated.',
    });
  } catch (error) {
    console.error('Failed to approve partner:', error);
    return NextResponse.json({ error: 'Failed to approve partner' }, { status: 500 });
  }
}
