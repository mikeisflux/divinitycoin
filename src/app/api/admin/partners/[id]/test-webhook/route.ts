// app/api/admin/partners/[id]/test-webhook/route.ts
// Send test webhook to partner

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { sendTestWebhook } from '@/lib/partner/webhook';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (!partner.webhookUrl) {
      return NextResponse.json(
        { error: 'Partner has no webhook URL configured' },
        { status: 400 }
      );
    }

    if (!partner.webhookSecret) {
      return NextResponse.json(
        { error: 'Partner has no webhook secret configured' },
        { status: 400 }
      );
    }

    const result = await sendTestWebhook(partner.webhookUrl, partner.webhookSecret);

    // Log the test webhook
    await logAdminAction(
      admin!.id,
      'PARTNER_TEST_WEBHOOK',
      'partner',
      params.id,
      {
        webhookUrl: partner.webhookUrl,
        success: result.success,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    // Log to API request log
    await prisma.apiRequestLog.create({
      data: {
        partnerId: partner.id,
        method: 'POST',
        endpoint: '/webhook',
        path: partner.webhookUrl,
        ipAddress: getClientIP(request) || 'unknown',
        userAgent: 'DivinityCoin-Webhook/1.0',
        statusCode: result.statusCode || 0,
        responseTimeMs: result.durationMs,
        requestBody: JSON.stringify({ event: 'test.ping' }),
        responseBody: result.responseBody?.substring(0, 1000) || result.error,
        errorMessage: result.error,
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || `Webhook returned status ${result.statusCode}`,
        statusCode: result.statusCode,
        responseBody: result.responseBody?.substring(0, 500),
        durationMs: result.durationMs,
      });
    }

    return NextResponse.json({
      success: true,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
    });
  } catch (error) {
    logger.apiError('Test webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to send test webhook' },
      { status: 500 }
    );
  }
}
