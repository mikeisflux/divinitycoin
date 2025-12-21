// app/api/partners/api-keys/route.ts
// Partner API key management

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';
import { generateApiKey, hashApiKey, encrypt } from '@/lib/encryption';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await prisma.partnerApiKey.findMany({
      where: { partnerId: partner.partnerId },
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

    // Add type from permissions
    const keysWithType = apiKeys.map(key => ({
      ...key,
      type: (key.permissions as any)?.type || 'api',
      requestCount: key.requestCount.toString(),
    }));

    return NextResponse.json({ apiKeys: keysWithType });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        key = `pk_${partner.partnerSlug}_${crypto.randomBytes(16).toString('base64url')}`;
        permissions.readonly = true;
        permissions.allowedEndpoints = ['validate', 'balance'];
        break;
      case 'private':
        key = `sk_${partner.partnerSlug}_${crypto.randomBytes(24).toString('base64url')}`;
        permissions.fullAccess = true;
        break;
      case 'oauth':
        key = `oauth_${partner.partnerSlug}_${crypto.randomBytes(32).toString('base64url')}`;
        permissions.oauth = true;
        permissions.clientSecret = crypto.randomBytes(32).toString('base64url');
        break;
      default: // 'api'
        key = generateApiKey(`${partner.partnerSlug}`);
        permissions.standard = true;
        break;
    }

    const keyHash = hashApiKey(key);
    const keyPrefix = key.slice(0, 12);

    await prisma.partnerApiKey.create({
      data: {
        partnerId: partner.partnerId,
        name,
        keyHash,
        keyPrefix,
        encryptedKey: encrypt(key),
        permissions,
      },
    });

    return NextResponse.json({
      success: true,
      key, // Return key only once on creation
      type,
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
