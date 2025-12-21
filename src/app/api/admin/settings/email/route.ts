// app/api/admin/settings/email/route.ts
// API for SMTP email settings

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const SMTP_CONFIG_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
  'SMTP_REPLY_TO',
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
          in: SMTP_CONFIG_KEYS,
        },
      },
    });

    const configMap = new Map(configs.map(c => [c.key, c.value]));

    const settings = {
      host: configMap.get('SMTP_HOST') || 'smtp.office365.com',
      port: parseInt(configMap.get('SMTP_PORT') || '587', 10),
      secure: configMap.get('SMTP_SECURE') === 'true',
      user: configMap.get('SMTP_USER') || '',
      pass: '', // Never return password
      fromEmail: configMap.get('SMTP_FROM_EMAIL') || '',
      fromName: configMap.get('SMTP_FROM_NAME') || 'DivinityCoin',
      replyTo: configMap.get('SMTP_REPLY_TO') || '',
      testEmailRecipient: '',
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
    const { host, port, secure, user, pass, fromEmail, fromName, replyTo } = await request.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (user && !emailRegex.test(user)) {
      return NextResponse.json({ error: 'Invalid SMTP username email format' }, { status: 400 });
    }
    if (fromEmail && !emailRegex.test(fromEmail)) {
      return NextResponse.json({ error: 'Invalid from email format' }, { status: 400 });
    }
    if (replyTo && !emailRegex.test(replyTo)) {
      return NextResponse.json({ error: 'Invalid reply-to email format' }, { status: 400 });
    }

    // Build update operations
    const operations = [
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_HOST' },
        update: { value: host || 'smtp.office365.com', updatedBy: admin!.id },
        create: { key: 'SMTP_HOST', value: host || 'smtp.office365.com', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_PORT' },
        update: { value: String(port || 587), updatedBy: admin!.id },
        create: { key: 'SMTP_PORT', value: String(port || 587), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_SECURE' },
        update: { value: secure ? 'true' : 'false', updatedBy: admin!.id },
        create: { key: 'SMTP_SECURE', value: secure ? 'true' : 'false', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_USER' },
        update: { value: user || '', updatedBy: admin!.id },
        create: { key: 'SMTP_USER', value: user || '', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_FROM_EMAIL' },
        update: { value: fromEmail || '', updatedBy: admin!.id },
        create: { key: 'SMTP_FROM_EMAIL', value: fromEmail || '', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_FROM_NAME' },
        update: { value: fromName || 'DivinityCoin', updatedBy: admin!.id },
        create: { key: 'SMTP_FROM_NAME', value: fromName || 'DivinityCoin', updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'SMTP_REPLY_TO' },
        update: { value: replyTo || '', updatedBy: admin!.id },
        create: { key: 'SMTP_REPLY_TO', value: replyTo || '', updatedBy: admin!.id },
      }),
    ];

    // Only update password if provided (non-empty)
    if (pass && pass.trim()) {
      const encryptedPass = encrypt(pass);
      operations.push(
        prisma.systemConfig.upsert({
          where: { key: 'SMTP_PASS' },
          update: { value: encryptedPass, isEncrypted: true, updatedBy: admin!.id },
          create: { key: 'SMTP_PASS', value: encryptedPass, isEncrypted: true, updatedBy: admin!.id },
        })
      );
    }

    await prisma.$transaction(operations);

    await logAdminAction(
      admin!.id,
      'EMAIL_SETTINGS_UPDATE',
      'settings',
      undefined,
      { host, port, secure, user, fromEmail, fromName, replyTo: replyTo || null },
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
