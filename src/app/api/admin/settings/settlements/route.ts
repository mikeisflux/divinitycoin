// app/api/admin/settings/settlements/route.ts
// Settlement system configuration API

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { getConfig, setConfig } from '@/lib/admin/config';

interface SettlementSettings {
  defaultPartnerFee: number;
  defaultMinimumSettlement: number;
  autoApproveEnabled: boolean;
  autoApproveThreshold: number;
  settlementNotificationEmail: string;
  webhookRetryAttempts: number;
  webhookTimeoutMs: number;
}

const DEFAULT_SETTINGS: SettlementSettings = {
  defaultPartnerFee: 6,
  defaultMinimumSettlement: 100,
  autoApproveEnabled: false,
  autoApproveThreshold: 500,
  settlementNotificationEmail: '',
  webhookRetryAttempts: 3,
  webhookTimeoutMs: 10000,
};

export async function GET() {
  try {
    const admin = await getAdminFromRequest();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all settlement config values
    const [
      defaultPartnerFee,
      defaultMinimumSettlement,
      autoApproveEnabled,
      autoApproveThreshold,
      settlementNotificationEmail,
      webhookRetryAttempts,
      webhookTimeoutMs,
    ] = await Promise.all([
      getConfig('DEFAULT_PARTNER_FEE'),
      getConfig('DEFAULT_MINIMUM_SETTLEMENT'),
      getConfig('AUTO_APPROVE_ENABLED'),
      getConfig('AUTO_APPROVE_THRESHOLD'),
      getConfig('SETTLEMENT_NOTIFICATION_EMAIL'),
      getConfig('WEBHOOK_RETRY_ATTEMPTS'),
      getConfig('WEBHOOK_TIMEOUT_MS'),
    ]);

    const settings: SettlementSettings = {
      defaultPartnerFee: defaultPartnerFee ? parseFloat(defaultPartnerFee) * 100 : DEFAULT_SETTINGS.defaultPartnerFee,
      defaultMinimumSettlement: defaultMinimumSettlement ? parseFloat(defaultMinimumSettlement) : DEFAULT_SETTINGS.defaultMinimumSettlement,
      autoApproveEnabled: autoApproveEnabled === 'true',
      autoApproveThreshold: autoApproveThreshold ? parseFloat(autoApproveThreshold) : DEFAULT_SETTINGS.autoApproveThreshold,
      settlementNotificationEmail: settlementNotificationEmail || DEFAULT_SETTINGS.settlementNotificationEmail,
      webhookRetryAttempts: webhookRetryAttempts ? parseInt(webhookRetryAttempts) : DEFAULT_SETTINGS.webhookRetryAttempts,
      webhookTimeoutMs: webhookTimeoutMs ? parseInt(webhookTimeoutMs) : DEFAULT_SETTINGS.webhookTimeoutMs,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch settlement settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      defaultPartnerFee,
      defaultMinimumSettlement,
      autoApproveEnabled,
      autoApproveThreshold,
      settlementNotificationEmail,
      webhookRetryAttempts,
      webhookTimeoutMs,
    } = body as SettlementSettings;

    // Validate
    if (defaultPartnerFee < 0 || defaultPartnerFee > 100) {
      return NextResponse.json({ error: 'Partner fee must be between 0 and 100%' }, { status: 400 });
    }

    if (defaultMinimumSettlement < 0) {
      return NextResponse.json({ error: 'Minimum settlement must be positive' }, { status: 400 });
    }

    if (autoApproveThreshold < 0) {
      return NextResponse.json({ error: 'Auto-approve threshold must be positive' }, { status: 400 });
    }

    // Save all settings
    await Promise.all([
      setConfig('DEFAULT_PARTNER_FEE', (defaultPartnerFee / 100).toString()),
      setConfig('DEFAULT_MINIMUM_SETTLEMENT', defaultMinimumSettlement.toString()),
      setConfig('AUTO_APPROVE_ENABLED', autoApproveEnabled ? 'true' : 'false'),
      setConfig('AUTO_APPROVE_THRESHOLD', autoApproveThreshold.toString()),
      setConfig('SETTLEMENT_NOTIFICATION_EMAIL', settlementNotificationEmail || ''),
      setConfig('WEBHOOK_RETRY_ATTEMPTS', webhookRetryAttempts.toString()),
      setConfig('WEBHOOK_TIMEOUT_MS', webhookTimeoutMs.toString()),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settlement settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
