// app/api/admin/partners/[id]/api-keys/[keyId]/route.ts
// Admin API for managing individual partner API keys

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const apiKey = await prisma.partnerApiKey.findFirst({
      where: {
        id: params.keyId,
        partnerId: params.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        requestCount: true,
        expiresAt: true,
        permissions: true,
        revokedAt: true,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      apiKey: {
        ...apiKey,
        type: (apiKey.permissions as any)?.type || 'api',
        requestCount: apiKey.requestCount.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch API key:', error);
    return NextResponse.json({ error: 'Failed to fetch API key' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const apiKey = await prisma.partnerApiKey.findFirst({
      where: {
        id: params.keyId,
        partnerId: params.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const data = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
      if (!data.isActive) {
        updateData.revokedAt = new Date();
      } else {
        updateData.revokedAt = null;
      }
    }

    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    const updatedKey = await prisma.partnerApiKey.update({
      where: { id: params.keyId },
      data: updateData,
    });

    const action = data.isActive === false ? 'PARTNER_API_KEY_REVOKE' :
                   data.isActive === true ? 'PARTNER_API_KEY_REACTIVATE' :
                   'PARTNER_API_KEY_UPDATE';

    await logAdminAction(
      admin!.id,
      action,
      'partnerApiKey',
      params.keyId,
      { partnerId: params.id, ...data },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        isActive: updatedKey.isActive,
        revokedAt: updatedKey.revokedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update API key:', error);
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const apiKey = await prisma.partnerApiKey.findFirst({
      where: {
        id: params.keyId,
        partnerId: params.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.partnerApiKey.delete({
      where: { id: params.keyId },
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_API_KEY_DELETE',
      'partnerApiKey',
      params.keyId,
      { partnerId: params.id, keyName: apiKey.name },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
