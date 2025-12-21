// app/api/admin/partners/[id]/route.ts
// Partner detail and update API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        apiKeys: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ partner });
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

    const partner = await prisma.partner.update({
      where: { id: params.id },
      data: {
        name: data.name,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        vpnIp: data.vpnIp,
        webhookUrl: data.webhookUrl,
        status: data.status,
      },
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
