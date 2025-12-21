// app/api/admin/settings/security/route.ts
// API for security settings

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'RATE_LIMIT_WINDOW_MS',
            'RATE_LIMIT_MAX_ATTEMPTS',
            'ADMIN_SESSION_EXPIRY_HOURS',
            'ADMIN_MAX_LOGIN_ATTEMPTS',
            'ADMIN_LOCKOUT_MINUTES',
            'REQUIRE_MFA',
          ],
        },
      },
    });

    const configMap = new Map(configs.map(c => [c.key, c.value]));

    const settings = {
      rateLimitWindowMs: parseInt(configMap.get('RATE_LIMIT_WINDOW_MS') || '60000'),
      rateLimitMaxAttempts: parseInt(configMap.get('RATE_LIMIT_MAX_ATTEMPTS') || '5'),
      adminSessionExpiryHours: parseInt(configMap.get('ADMIN_SESSION_EXPIRY_HOURS') || '8'),
      adminMaxLoginAttempts: parseInt(configMap.get('ADMIN_MAX_LOGIN_ATTEMPTS') || '5'),
      adminLockoutMinutes: parseInt(configMap.get('ADMIN_LOCKOUT_MINUTES') || '30'),
      requireMfa: configMap.get('REQUIRE_MFA') === 'true',
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch security settings:', error);
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
    const {
      rateLimitWindowMs,
      rateLimitMaxAttempts,
      adminSessionExpiryHours,
      adminMaxLoginAttempts,
      adminLockoutMinutes,
      requireMfa,
    } = await request.json();

    // Validate
    if (rateLimitWindowMs < 1000) {
      return NextResponse.json({ error: 'Rate limit window must be at least 1 second' }, { status: 400 });
    }
    if (rateLimitMaxAttempts < 1) {
      return NextResponse.json({ error: 'Max attempts must be at least 1' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.systemConfig.upsert({
        where: { key: 'RATE_LIMIT_WINDOW_MS' },
        update: { value: rateLimitWindowMs.toString(), updatedBy: admin!.id },
        create: { key: 'RATE_LIMIT_WINDOW_MS', value: rateLimitWindowMs.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'RATE_LIMIT_MAX_ATTEMPTS' },
        update: { value: rateLimitMaxAttempts.toString(), updatedBy: admin!.id },
        create: { key: 'RATE_LIMIT_MAX_ATTEMPTS', value: rateLimitMaxAttempts.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'ADMIN_SESSION_EXPIRY_HOURS' },
        update: { value: adminSessionExpiryHours.toString(), updatedBy: admin!.id },
        create: { key: 'ADMIN_SESSION_EXPIRY_HOURS', value: adminSessionExpiryHours.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'ADMIN_MAX_LOGIN_ATTEMPTS' },
        update: { value: adminMaxLoginAttempts.toString(), updatedBy: admin!.id },
        create: { key: 'ADMIN_MAX_LOGIN_ATTEMPTS', value: adminMaxLoginAttempts.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'ADMIN_LOCKOUT_MINUTES' },
        update: { value: adminLockoutMinutes.toString(), updatedBy: admin!.id },
        create: { key: 'ADMIN_LOCKOUT_MINUTES', value: adminLockoutMinutes.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'REQUIRE_MFA' },
        update: { value: requireMfa ? 'true' : 'false', updatedBy: admin!.id },
        create: { key: 'REQUIRE_MFA', value: requireMfa ? 'true' : 'false', updatedBy: admin!.id },
      }),
    ]);

    await logAdminAction(
      admin!.id,
      'SECURITY_SETTINGS_UPDATE',
      'settings',
      undefined,
      {
        rateLimitWindowMs,
        rateLimitMaxAttempts,
        adminSessionExpiryHours,
        adminMaxLoginAttempts,
        adminLockoutMinutes,
        requireMfa,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save security settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
