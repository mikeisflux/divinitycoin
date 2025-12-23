// app/api/admin/partners/[id]/api-keys/route.ts
// Admin API for managing partner API keys

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { hashApiKey, encrypt } from '@/lib/encryption';
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
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const apiKeys = await prisma.partnerApiKey.findMany({
      where: { partnerId: params.id },
      orderBy: { createdAt: 'desc' },
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
      },
    });

    const keysWithType = apiKeys.map(key => ({
      ...key,
      type: (key.permissions as any)?.type || 'api',
      requestCount: key.requestCount.toString(),
    }));

    return NextResponse.json({ apiKeys: keysWithType });
  } catch (error) {
    logger.apiError('Failed to fetch partner API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate secret API key for server-to-server calls
    const key = `sk_${partner.slug}_${crypto.randomBytes(24).toString('base64url')}`;
    const permissions = { fullAccess: true };
    const type = 'api';

    const keyHash = hashApiKey(key);
    const keyPrefix = key.slice(0, 12);

    const apiKey = await prisma.partnerApiKey.create({
      data: {
        partnerId: partner.id,
        name,
        keyHash,
        keyPrefix,
        encryptedKey: encrypt(key),
        permissions,
      },
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_API_KEY_CREATE',
      'partnerApiKey',
      apiKey.id,
      { partnerId: partner.id, name, type },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      key, // Return key only once on creation
      type,
      keyId: apiKey.id,
    });
  } catch (error) {
    logger.apiError('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
