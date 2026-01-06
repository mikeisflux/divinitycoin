// app/api/webhooks/partners/[partnerId]/route.ts
// Webhook endpoint for partner integrations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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
      logger.warn(`Webhook secret not configured for partner ${partner.id}`);
      return NextResponse.json(
        { error: 'Webhook security not configured. Please set up a webhook secret.' },
        { status: 403 }
      );
    }

    const isValid = verifySignature(rawBody, signature, partner.webhookSecret);
    if (!isValid) {
      logger.warn(`Invalid webhook signature for partner ${partner.id}`);
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

      case 'transaction.refund': {
        // Partner is notifying us that they refunded a transaction
        // This happens when a customer gets a refund on the partner's platform
        const { transactionId, cardCode, amount, reason, partnerTransactionId } = payload.data || {};

        if (!transactionId && !cardCode) {
          return NextResponse.json(
            { error: 'Either transactionId or cardCode is required' },
            { status: 400 }
          );
        }

        logger.info('Partner refund webhook received', {
          partnerId: partner.id,
          partnerName: partner.name,
          transactionId,
          cardCode: cardCode ? `****${cardCode.slice(-4)}` : undefined,
          amount,
          reason,
          partnerTransactionId,
        });

        // Find the gift card and associated transaction
        let giftCard;
        if (cardCode) {
          // Find by card code (hashed)
          const crypto = await import('crypto');
          const codeHash = crypto.createHash('sha256').update(cardCode.toUpperCase()).digest('hex');
          giftCard = await prisma.giftCard.findFirst({
            where: { codeHash },
            include: { transaction: true },
          });
        } else if (transactionId) {
          // Find by transaction ID
          const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { giftCard: { include: { transaction: true } } },
          });
          giftCard = transaction?.giftCard;
        }

        if (!giftCard) {
          logger.warn('Gift card not found for partner refund', { transactionId, cardCode });
          return NextResponse.json(
            { error: 'Gift card not found' },
            { status: 404 }
          );
        }

        // Check if already refunded
        if (giftCard.status === 'REFUNDED') {
          return NextResponse.json({
            success: true,
            message: 'Card already marked as refunded',
            cardId: giftCard.id,
          });
        }

        // Update gift card status to REFUNDED
        await prisma.giftCard.update({
          where: { id: giftCard.id },
          data: {
            status: 'REFUNDED',
            metadata: {
              ...(typeof giftCard.metadata === 'object' ? giftCard.metadata : {}),
              partnerRefund: {
                partnerId: partner.id,
                partnerName: partner.name,
                partnerTransactionId,
                reason: reason || 'Refunded by partner',
                refundedAt: new Date().toISOString(),
              },
            },
          },
        });

        // Update associated transaction status if exists
        if (giftCard.transaction) {
          await prisma.transaction.update({
            where: { id: giftCard.transaction.id },
            data: {
              status: 'REFUNDED',
              metadata: {
                ...(typeof giftCard.transaction.metadata === 'object' ? giftCard.transaction.metadata : {}),
                partnerRefund: {
                  partnerId: partner.id,
                  partnerName: partner.name,
                  partnerTransactionId,
                  reason: reason || 'Refunded by partner',
                  refundedAt: new Date().toISOString(),
                },
              },
            },
          });
        }

        logger.info('Gift card marked as refunded by partner', {
          giftCardId: giftCard.id,
          partnerId: partner.id,
          partnerTransactionId,
        });

        return NextResponse.json({
          success: true,
          message: 'Card marked as refunded',
          cardId: giftCard.id,
        });
      }

      default:
        // Unknown event type - log and acknowledge
        logger.info(`Unknown webhook event: ${event}`);
        return NextResponse.json({
          received: true,
          event,
          message: 'Event acknowledged but not processed',
        });
    }
  } catch (error) {
    logger.apiError('/api/webhooks/partners', error);
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
        'transaction.refund',
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
