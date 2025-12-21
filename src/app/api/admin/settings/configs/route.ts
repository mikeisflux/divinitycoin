// app/api/admin/settings/configs/route.ts
// API for managing system configuration (API keys, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

// Keys that should be encrypted
const ENCRYPTED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'SENDGRID_WEBHOOK_SECRET',
  'INTERNAL_API_KEY',
  'ADMIN_SESSION_SECRET',
  'ENCRYPTION_SECRET',
];

// Keys that should be masked in responses
const SENSITIVE_KEYS = [
  ...ENCRYPTED_KEYS,
  'DATABASE_URL',
];

export async function GET(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Map configs with masked values for sensitive keys
    const maskedConfigs = configs.map(config => {
      const isSensitive = SENSITIVE_KEYS.includes(config.key);
      let maskedValue = '';

      if (config.value) {
        if (isSensitive) {
          try {
            const decrypted = config.isEncrypted ? decrypt(config.value) : config.value;
            maskedValue = maskApiKey(decrypted);
          } catch {
            maskedValue = '****';
          }
        } else {
          maskedValue = config.isEncrypted ? decrypt(config.value) : config.value;
        }
      }

      return {
        key: config.key,
        hasValue: !!config.value,
        maskedValue,
        updatedAt: config.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ configs: maskedConfigs });
  } catch (error) {
    console.error('Failed to fetch configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
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
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    // Validate key format (alphanumeric and underscores only)
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      return NextResponse.json(
        { error: 'Invalid key format' },
        { status: 400 }
      );
    }

    const shouldEncrypt = ENCRYPTED_KEYS.includes(key);
    const storedValue = shouldEncrypt ? encrypt(value) : value;

    await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: storedValue,
        isEncrypted: shouldEncrypt,
        updatedAt: new Date(),
        updatedBy: admin!.id,
      },
      create: {
        key,
        value: storedValue,
        isEncrypted: shouldEncrypt,
        updatedBy: admin!.id,
      },
    });

    // Log the action (don't log the actual value for security)
    await logAdminAction(
      admin!.id,
      'CONFIG_UPDATE',
      'systemConfig',
      key,
      { key, encrypted: shouldEncrypt },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    await prisma.systemConfig.delete({
      where: { key },
    });

    // Log the action
    await logAdminAction(
      admin!.id,
      'CONFIG_DELETE',
      'systemConfig',
      key,
      { key },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete config:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
