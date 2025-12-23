// app/api/webhooks/partners/[partnerId]/route.ts
// Webhook endpoint for partner integrations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { checkCodeStatus, validateAndRedeemCode } from '@/lib/giftcard/redeem';

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  // Parse the signature header (format: t=timestamp,v1=signature)
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const receivedSignature = signaturePart.slice(3);

  // Verify timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);
  if (Math.abs(now - webhookTime) > 300) {
    return false; // Replay attack protection
  }

  // Compute expected signature
  const signaturePayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    // Get partner
    const partner = await prisma.partner.findUnique({
      where: { id: params.partnerId },
      select: {
        id: true,
        name: true,
        status: true,
        webhookSecret: true,
        webhookEvents: true,
        settings: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Get sandbox mode from settings (default to true for safety)
    const partnerSettings = (partner.settings as Record<string, unknown>) || {};
    const sandboxMode = partnerSettings.sandboxMode !== false;

    if (partner.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Partner is not active' }, { status: 403 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('X-Webhook-Signature') || '';

    // SECURITY: Webhook signature verification is MANDATORY
    // Partners must have a webhook secret configured
    if (!partner.webhookSecret) {
      console.error(`Webhook secret not configured for partner ${partner.id}`);
      return NextResponse.json(
        { error: 'Webhook security not configured. Please set up a webhook secret.' },
        { status: 403 }
      );
    }

    const isValid = verifySignature(rawBody, signature, partner.webhookSecret);
    if (!isValid) {
      console.error(`Invalid webhook signature for partner ${partner.id}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const event = payload.event || request.headers.get('X-Webhook-Event') || 'unknown';

    // Log the webhook
    console.log(`Webhook received for partner ${partner.name}: ${event}`, {
      partnerId: partner.id,
      event,
      sandboxMode,
    });

    // Process based on event type
    switch (event) {
      case 'test.ping':
        // Test webhook - just acknowledge
        return NextResponse.json({
          success: true,
          message: 'Webhook received successfully',
          partnerId: partner.id,
          sandboxMode,
        });

      case 'card.validate': {
        // Gift card validation request
        const { cardCode } = payload.data || {};
        if (!cardCode) {
          return NextResponse.json({ error: 'Card code required' }, { status: 400 });
        }

        // Use the existing checkCodeStatus function
        const result = await checkCodeStatus(cardCode);

        return NextResponse.json({
          valid: result.valid,
          status: result.status,
          amount: result.amount,
          error: result.error,
        });
      }

      case 'card.redeem': {
        // Gift card redemption request
        const { cardCode, platformUserId } = payload.data || {};
        if (!cardCode) {
          return NextResponse.json({ error: 'Card code required' }, { status: 400 });
        }

        // In sandbox mode, just validate without redeeming
        if (sandboxMode) {
          const checkResult = await checkCodeStatus(cardCode);
          return NextResponse.json({
            success: checkResult.valid,
            sandboxMode: true,
            message: 'Sandbox mode - no actual redemption performed',
            amount: checkResult.amount,
            status: checkResult.status,
            error: checkResult.error,
          });
        }

        // Get client info for logging
        const ipAddress = request.headers.get('x-forwarded-for') ||
                         request.headers.get('x-real-ip') ||
                         'unknown';
        const userAgent = request.headers.get('user-agent') || undefined;

        // Use the existing validateAndRedeemCode function
        const result = await validateAndRedeemCode({
          code: cardCode,
          platformUserId: platformUserId || `partner_${partner.id}`,
          ipAddress,
          userAgent,
          partnerId: partner.id,
        });

        return NextResponse.json({
          success: result.success,
          amount: result.amount,
          newBalance: result.newBalance,
          error: result.error,
          message: result.message,
        });
      }

      default:
        // Unknown event type - log and acknowledge
        console.log(`Unknown webhook event: ${event}`);
        return NextResponse.json({
          received: true,
          event,
          message: 'Event acknowledged but not processed',
        });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check for webhook endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.partnerId },
      select: { id: true, name: true, status: true, settings: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Get sandbox mode from settings (default to true for safety)
    const partnerSettings = (partner.settings as Record<string, unknown>) || {};
    const sandboxMode = partnerSettings.sandboxMode !== false;

    return NextResponse.json({
      status: 'ok',
      partnerId: partner.id,
      partnerName: partner.name,
      partnerStatus: partner.status,
      sandboxMode,
      supportedEvents: [
        'test.ping',
        'card.validate',
        'card.redeem',
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
