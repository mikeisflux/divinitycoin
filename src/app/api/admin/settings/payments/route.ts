// app/api/admin/settings/payments/route.ts
// API for payment settings

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

const PAYMENT_SETTINGS_KEYS = [
  'PAYMENT_MIN_AMOUNT',
  'PAYMENT_MAX_AMOUNT',
  'PAYMENT_PRESET_AMOUNTS',
  'PAYMENT_CURRENCY',
];

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);

  if (!authorized) {
    return response;
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: PAYMENT_SETTINGS_KEYS } },
    });

    const configMap = new Map(configs.map(c => [c.key, c.value]));

    const settings = {
      minAmount: parseFloat(configMap.get('PAYMENT_MIN_AMOUNT') || '5'),
      maxAmount: parseFloat(configMap.get('PAYMENT_MAX_AMOUNT') || '500'),
      presetAmounts: JSON.parse(configMap.get('PAYMENT_PRESET_AMOUNTS') || '[10, 25, 50, 100, 250]'),
      currency: configMap.get('PAYMENT_CURRENCY') || 'USD',
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch payment settings:', error);
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
    const { minAmount, maxAmount, presetAmounts, currency } = await request.json();

    // Validate
    if (minAmount < 1) {
      return NextResponse.json({ error: 'Minimum amount must be at least $1' }, { status: 400 });
    }
    if (maxAmount < minAmount) {
      return NextResponse.json({ error: 'Maximum amount must be greater than minimum' }, { status: 400 });
    }
    if (!Array.isArray(presetAmounts)) {
      return NextResponse.json({ error: 'Preset amounts must be an array' }, { status: 400 });
    }

    // Save settings
    await prisma.$transaction([
      prisma.systemConfig.upsert({
        where: { key: 'PAYMENT_MIN_AMOUNT' },
        update: { value: minAmount.toString(), updatedBy: admin!.id },
        create: { key: 'PAYMENT_MIN_AMOUNT', value: minAmount.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'PAYMENT_MAX_AMOUNT' },
        update: { value: maxAmount.toString(), updatedBy: admin!.id },
        create: { key: 'PAYMENT_MAX_AMOUNT', value: maxAmount.toString(), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'PAYMENT_PRESET_AMOUNTS' },
        update: { value: JSON.stringify(presetAmounts), updatedBy: admin!.id },
        create: { key: 'PAYMENT_PRESET_AMOUNTS', value: JSON.stringify(presetAmounts), updatedBy: admin!.id },
      }),
      prisma.systemConfig.upsert({
        where: { key: 'PAYMENT_CURRENCY' },
        update: { value: currency, updatedBy: admin!.id },
        create: { key: 'PAYMENT_CURRENCY', value: currency, updatedBy: admin!.id },
      }),
    ]);

    await logAdminAction(
      admin!.id,
      'PAYMENT_SETTINGS_UPDATE',
      'settings',
      undefined,
      { minAmount, maxAmount, presetAmounts, currency },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save payment settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
