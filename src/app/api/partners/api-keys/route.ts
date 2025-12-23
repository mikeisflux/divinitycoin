// app/api/partners/api-keys/route.ts
// Partner API key management

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';
import { hashApiKey, encrypt } from '@/lib/encryption';
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
    logger.apiError('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate secret API key for server-to-server calls
    const key = `sk_${partner.partnerSlug}_${crypto.randomBytes(24).toString('base64url')}`;
    const permissions = { fullAccess: true };
    const type = 'api';

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
    logger.apiError('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
