// app/api/admin/settings/email/route.ts
// API for SendGrid email settings

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { clearConfigCache } from '@/lib/config';

const SENDGRID_CONFIG_KEYS = [
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'SENDGRID_FROM_NAME',
  'SENDGRID_REPLY_TO',
];

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: SENDGRID_CONFIG_KEYS,
        },
      },
    });

    const configMap = new Map(configs.map((c: { key: string; value: string }) => [c.key, c.value]));

    const hasApiKey = configs.some((c: { key: string; value: string }) => c.key === 'SENDGRID_API_KEY' && c.value);
    const fromEmail = configMap.get('SENDGRID_FROM_EMAIL') || '';

    const settings = {
      apiKey: hasApiKey ? '••••••••' : '',
      fromEmail,
      fromName: configMap.get('SENDGRID_FROM_NAME') || 'DivinityCoin',
      replyTo: configMap.get('SENDGRID_REPLY_TO') || '',
      testEmailRecipient: '',
      isConfigured: !!(hasApiKey && fromEmail),
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch email settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
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
    const { apiKey, fromEmail, fromName, replyTo } = await request.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (fromEmail && !emailRegex.test(fromEmail)) {
      return NextResponse.json({ error: 'Invalid from email format' }, { status: 400 });
    }
    if (replyTo && !emailRegex.test(replyTo)) {
      return NextResponse.json({ error: 'Invalid reply-to email format' }, { status: 400 });
    }

    // Build update operations
    const operations = [
      prisma.systemConfig.upsert({
        where: { key: 'SENDGRID_FROM_EMAIL' },
        update: { value: fromEmail || '', updatedBy: admin!.id },
        create: { key: 'SENDGRID_FROM_EMAIL', value: fromEmail || '', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SENDGRID_FROM_NAME' },
        update: { value: fromName || 'DivinityCoin', updatedBy: admin!.id },
        create: { key: 'SENDGRID_FROM_NAME', value: fromName || 'DivinityCoin', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SENDGRID_REPLY_TO' },
        update: { value: replyTo || '', updatedBy: admin!.id },
        create: { key: 'SENDGRID_REPLY_TO', value: replyTo || '', updatedBy: admin!.id },
      }),
    ];

    // Only update API key if provided (non-empty and not placeholder)
    if (apiKey && apiKey.trim() && apiKey !== '••••••••') {
      const encryptedKey = encrypt(apiKey);
      operations.push(
        prisma.systemConfig.upsert({
          where: { key: 'SENDGRID_API_KEY' },
          update: { value: encryptedKey, isEncrypted: true, updatedBy: admin!.id },
          create: { key: 'SENDGRID_API_KEY', value: encryptedKey, isEncrypted: true, updatedBy: admin!.id },
        })
      );
    }

    await prisma.$transaction(operations);

    // Clear config cache so new settings take effect immediately
    clearConfigCache();

    await logAdminAction(
      admin!.id,
      'EMAIL_SETTINGS_UPDATE',
      'settings',
      undefined,
      { fromEmail, fromName, replyTo: replyTo || null },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save email settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
