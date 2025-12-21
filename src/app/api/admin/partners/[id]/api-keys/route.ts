// app/api/admin/partners/[id]/api-keys/route.ts
// Admin API for managing partner API keys

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { generateApiKey, hashApiKey, encrypt } from '@/lib/encryption';
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
    console.error('Failed to fetch partner API keys:', error);
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

    const { name, type } = await request.json();

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    // Generate appropriate key based on type
    let key: string;
    let permissions: any = { type };

    switch (type) {
      case 'public':
        key = `pk_${partner.slug}_${crypto.randomBytes(16).toString('base64url')}`;
        permissions.readonly = true;
        permissions.allowedEndpoints = ['validate', 'balance'];
        break;
      case 'private':
        key = `sk_${partner.slug}_${crypto.randomBytes(24).toString('base64url')}`;
        permissions.fullAccess = true;
        break;
      case 'oauth':
        key = `oauth_${partner.slug}_${crypto.randomBytes(32).toString('base64url')}`;
        permissions.oauth = true;
        permissions.clientSecret = crypto.randomBytes(32).toString('base64url');
        break;
      default: // 'api'
        key = generateApiKey(`${partner.slug}`);
        permissions.standard = true;
        break;
    }

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
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
