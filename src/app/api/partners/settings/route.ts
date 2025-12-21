// app/api/partners/settings/route.ts
// Partner settings API

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerData = await prisma.partner.findUnique({
      where: { id: partner.partnerId },
      select: {
        webhookUrl: true,
        webhookSecret: true,
        webhookEvents: true,
        contactEmail: true,
        settings: true,
      },
    });

    if (!partnerData) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const settings = partnerData.settings as any || {};

    return NextResponse.json({
      settings: {
        webhookUrl: partnerData.webhookUrl || '',
        webhookSecret: partnerData.webhookSecret ? '••••••••••••••••' : '',
        webhookEvents: partnerData.webhookEvents || [],
        notificationEmail: settings.notificationEmail || partnerData.contactEmail || '',
        ipWhitelist: settings.ipWhitelist || [],
        rateLimitTier: settings.rateLimitTier || 'standard',
      },
    });
  } catch (error) {
    console.error('Failed to fetch partner settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { webhookUrl, webhookEvents, notificationEmail, ipWhitelist, rateLimitTier } = body;

    // Validate webhook URL if provided
    if (webhookUrl) {
      try {
        new URL(webhookUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
      }
    }

    // Get current settings
    const currentPartner = await prisma.partner.findUnique({
      where: { id: partner.partnerId },
      select: { settings: true },
    });

    const currentSettings = currentPartner?.settings as any || {};

    // Update partner
    await prisma.partner.update({
      where: { id: partner.partnerId },
      data: {
        webhookUrl: webhookUrl || null,
        webhookEvents: webhookEvents || [],
        settings: {
          ...currentSettings,
          notificationEmail,
          ipWhitelist: ipWhitelist || [],
          rateLimitTier: rateLimitTier || 'standard',
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update partner settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
