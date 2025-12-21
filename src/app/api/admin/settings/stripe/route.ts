// app/api/admin/settings/stripe/route.ts
// API for Stripe API key settings

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { clearConfigCache } from '@/lib/config';
import { clearStripeCache } from '@/lib/stripe';

const STRIPE_CONFIG_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: STRIPE_CONFIG_KEYS,
        },
      },
    });

    const configMap = new Map(configs.map(c => [c.key, c.value]));

    // Only return masked keys for security
    const secretKey = configMap.get('STRIPE_SECRET_KEY') || '';
    const publishableKey = configMap.get('STRIPE_PUBLISHABLE_KEY') || '';
    const webhookSecret = configMap.get('STRIPE_WEBHOOK_SECRET') || '';

    const settings = {
      secretKey: secretKey ? '****' + secretKey.slice(-4) : '',
      publishableKey: publishableKey || '',
      webhookSecret: webhookSecret ? '****' + webhookSecret.slice(-4) : '',
      isConfigured: !!(secretKey && publishableKey),
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch Stripe settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { secretKey, publishableKey, webhookSecret } = await request.json();

    const operations = [];

    // Only update keys if provided (non-empty)
    if (secretKey && secretKey.trim() && !secretKey.startsWith('****')) {
      // Validate secret key format
      if (!secretKey.startsWith('sk_')) {
        return NextResponse.json({ error: 'Invalid secret key format. Must start with sk_' }, { status: 400 });
      }
      const encryptedKey = encrypt(secretKey);
      operations.push(
        prisma.systemConfig.upsert({
          where: { key: 'STRIPE_SECRET_KEY' },
          update: { value: encryptedKey, isEncrypted: true, updatedBy: admin!.id },
          create: { key: 'STRIPE_SECRET_KEY', value: encryptedKey, isEncrypted: true, updatedBy: admin!.id },
        })
      );
    }

    if (publishableKey && publishableKey.trim()) {
      // Validate publishable key format
      if (!publishableKey.startsWith('pk_')) {
        return NextResponse.json({ error: 'Invalid publishable key format. Must start with pk_' }, { status: 400 });
      }
      operations.push(
        prisma.systemConfig.upsert({
          where: { key: 'STRIPE_PUBLISHABLE_KEY' },
          update: { value: publishableKey, updatedBy: admin!.id },
          create: { key: 'STRIPE_PUBLISHABLE_KEY', value: publishableKey, updatedBy: admin!.id },
        })
      );
    }

    if (webhookSecret && webhookSecret.trim() && !webhookSecret.startsWith('****')) {
      // Validate webhook secret format
      if (!webhookSecret.startsWith('whsec_')) {
        return NextResponse.json({ error: 'Invalid webhook secret format. Must start with whsec_' }, { status: 400 });
      }
      const encryptedWebhook = encrypt(webhookSecret);
      operations.push(
        prisma.systemConfig.upsert({
          where: { key: 'STRIPE_WEBHOOK_SECRET' },
          update: { value: encryptedWebhook, isEncrypted: true, updatedBy: admin!.id },
          create: { key: 'STRIPE_WEBHOOK_SECRET', value: encryptedWebhook, isEncrypted: true, updatedBy: admin!.id },
        })
      );
    }

    if (operations.length === 0) {
      return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 });
    }

    await prisma.$transaction(operations);

    // Clear caches so new settings take effect immediately
    clearConfigCache();
    clearStripeCache();

    await logAdminAction(
      admin!.id,
      'STRIPE_SETTINGS_UPDATE',
      'settings',
      undefined,
      {
        secretKeyUpdated: !!(secretKey && !secretKey.startsWith('****')),
        publishableKeyUpdated: !!publishableKey,
        webhookSecretUpdated: !!(webhookSecret && !webhookSecret.startsWith('****')),
      },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save Stripe settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
