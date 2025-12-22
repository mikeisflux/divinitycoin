// app/api/admin/partners/[id]/route.ts
// Partner detail and update API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    let partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        apiKeys: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Auto-generate webhook URL and secret for existing partners if missing
    if (!partner.webhookUrl || !partner.webhookSecret) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://divinitycoin.com';
      const updateData: Record<string, string> = {};

      if (!partner.webhookUrl) {
        updateData.webhookUrl = `${baseUrl}/api/webhooks/partners/${partner.id}`;
      }
      if (!partner.webhookSecret) {
        updateData.webhookSecret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
      }

      partner = await prisma.partner.update({
        where: { id: partner.id },
        data: updateData,
        include: {
          apiKeys: true,
        },
      });
    }

    // Get sandboxMode from settings (default to true)
    const partnerSettings = (partner.settings as Record<string, unknown>) || {};
    const sandboxMode = partnerSettings.sandboxMode !== false;

    // Convert BigInt fields to numbers for JSON serialization
    const serializedPartner = {
      ...partner,
      sandboxMode, // Add sandboxMode from settings
      apiKeys: partner.apiKeys.map(key => ({
        ...key,
        requestCount: Number(key.requestCount),
      })),
    };

    return NextResponse.json({ partner: serializedPartner });
  } catch (error) {
    console.error('Failed to fetch partner:', error);
    return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const data = await request.json();

    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.contactName !== undefined) updateData.contactName = data.contactName;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.vpnIp !== undefined) updateData.vpnIp = data.vpnIp;
    if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
    if (data.status !== undefined) updateData.status = data.status;

    // Handle sandboxMode - store in settings JSON until schema is migrated
    if (data.sandboxMode !== undefined) {
      const existingPartner = await prisma.partner.findUnique({
        where: { id: params.id },
        select: { settings: true },
      });
      const existingSettings = (existingPartner?.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...existingSettings,
        sandboxMode: data.sandboxMode,
      };
    }

    const partner = await prisma.partner.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_UPDATE',
      'partner',
      params.id,
      data,
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ partner });
  } catch (error) {
    console.error('Failed to update partner:', error);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    await prisma.partner.delete({
      where: { id: params.id },
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_DELETE',
      'partner',
      params.id,
      {},
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete partner:', error);
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}
