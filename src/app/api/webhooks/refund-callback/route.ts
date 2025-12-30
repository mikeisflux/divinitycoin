// app/api/webhooks/refund-callback/route.ts
// Webhook endpoint for partners to report refund results
// This handles callbacks from partners after they process (or fail to process) a refund request

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Verify webhook signature from partner
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Parse signature: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = timestampPart.slice(2);
    const providedSignature = signaturePart.slice(3);

    // Check timestamp is within 5 minutes
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) {
      logger.warn('Webhook signature timestamp too old', { timestampAge });
      return false;
    }

    // Verify signature
    const signaturePayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Failed to verify webhook signature', { error });
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('X-Webhook-Signature');
    const rawBody = await request.text();

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { event, data } = payload;

    // Handle refund.failed callback from partner
    if (event === 'refund.failed') {
      const { refundId, errorCode, errorMessage, shortfall, maskedCardCode, userId } = data;

      if (!refundId) {
        return NextResponse.json({ error: 'Missing refundId' }, { status: 400 });
      }

      // Find the refund request
      const refundRequest = await prisma.refundRequest.findUnique({
        where: { id: refundId },
      });

      if (!refundRequest) {
        return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
      }

      // Verify signature using partner's webhook secret
      if (refundRequest.partnerId) {
        const partner = await prisma.partner.findUnique({
          where: { id: refundRequest.partnerId },
          select: { webhookSecret: true },
        });

        if (partner?.webhookSecret && !verifySignature(rawBody, signature, partner.webhookSecret)) {
          logger.warn('Invalid webhook signature for refund callback', { refundId });
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }

      // Update refund request with failure
      await prisma.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: errorMessage || `Refund failed: ${errorCode}`,
          webhookResponse: {
            event: 'refund.failed',
            errorCode,
            errorMessage,
            shortfall,
            maskedCardCode,
            userId,
            receivedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Refund callback received: failed', {
        refundId,
        errorCode,
        shortfall,
      });

      return NextResponse.json({
        success: true,
        message: 'Failure recorded',
      });
    }

    // Handle refund.success callback (for async partner processing)
    if (event === 'refund.success') {
      const { refundId, amountDeducted, previousBalance, newBalance, partnerRefundId } = data;

      if (!refundId) {
        return NextResponse.json({ error: 'Missing refundId' }, { status: 400 });
      }

      const refundRequest = await prisma.refundRequest.findUnique({
        where: { id: refundId },
        include: {
          // We need transaction info to process Stripe refund
        },
      });

      if (!refundRequest) {
        return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
      }

      // Verify signature
      if (refundRequest.partnerId) {
        const partner = await prisma.partner.findUnique({
          where: { id: refundRequest.partnerId },
          select: { webhookSecret: true },
        });

        if (partner?.webhookSecret && !verifySignature(rawBody, signature, partner.webhookSecret)) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }

      // Update refund request - mark as approved for Stripe processing
      await prisma.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'APPROVED',
          partnerRefundId: partnerRefundId || null,
          webhookResponse: {
            event: 'refund.success',
            amountDeducted,
            previousBalance,
            newBalance,
            partnerRefundId,
            receivedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Refund callback received: success', {
        refundId,
        amountDeducted,
        partnerRefundId,
      });

      // Note: Stripe refund should be processed separately by a worker or admin action
      // This is because we don't want to hold the webhook response waiting for Stripe

      return NextResponse.json({
        success: true,
        message: 'Success recorded. Stripe refund will be processed.',
      });
    }

    // Unknown event type
    return NextResponse.json({
      error: 'Unknown event type',
      receivedEvent: event,
    }, { status: 400 });

  } catch (error) {
    logger.error('Failed to process refund callback webhook', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
