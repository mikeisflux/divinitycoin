// app/api/admin/partners/[id]/resend-setup/route.ts
// Resend partner setup link

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

    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const settings = partner.settings as any;

    // Check if partner already completed setup
    if (settings?.passwordHash) {
      return NextResponse.json(
        { error: 'Partner has already completed setup' },
        { status: 400 }
      );
    }

    // Generate new setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const updatedSettings = {
      ...settings,
      setupToken,
      setupTokenExpires: setupTokenExpires.toISOString(),
    };

    await prisma.partner.update({
      where: { id: params.id },
      data: { settings: updatedSettings },
    });

    // Generate setup URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const setupUrl = `${baseUrl}/partners/setup?token=${setupToken}`;

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'partner.resend_setup',
        resource: 'Partner',
        resourceId: params.id,
        details: JSON.stringify({
          partnerName: partner.name,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      setupUrl,
    });
  } catch (error) {
    console.error('Failed to resend setup link:', error);
    return NextResponse.json({ error: 'Failed to resend setup link' }, { status: 500 });
  }
}
