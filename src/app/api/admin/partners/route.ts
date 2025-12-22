// app/api/admin/partners/route.ts
// Partner management API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { generateApiKey, hashApiKey, encrypt } from '@/lib/encryption';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const partners = await prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { apiKeys: true } },
      },
    });

    return NextResponse.json({ partners });
  } catch (error) {
    console.error('Failed to fetch partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { name, slug, vpnIp, webhookUrl, contactEmail, contactName } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.partner.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A partner with this slug already exists' },
        { status: 400 }
      );
    }

    // Generate webhook secret for the partner (used to sign outgoing webhooks)
    const webhookSecret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;

    // Create partner - webhookUrl will be set by admin when partner provides their endpoint
    const partner = await prisma.partner.create({
      data: {
        name,
        slug,
        vpnIp: vpnIp || null,
        webhookUrl: webhookUrl || null, // Partner's webhook endpoint (they provide this)
        webhookSecret,
        contactEmail: contactEmail || null,
        contactName: contactName || null,
        status: 'PENDING',
      },
    });

    // Generate initial API key
    const apiKey = generateApiKey('pk');
    const keyHash = hashApiKey(apiKey);

    await prisma.partnerApiKey.create({
      data: {
        partnerId: partner.id,
        keyHash,
        keyPrefix: apiKey.slice(0, 10),
        name: 'Default API Key',
        encryptedKey: encrypt(apiKey),
      },
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_CREATE',
      'partner',
      partner.id,
      { name, slug },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      partner,
      apiKey, // Return the API key only once on creation
      webhookSecret, // Return the webhook secret only once on creation
    });
  } catch (error) {
    console.error('Failed to create partner:', error);
    return NextResponse.json(
      { error: 'Failed to create partner' },
      { status: 500 }
    );
  }
}
