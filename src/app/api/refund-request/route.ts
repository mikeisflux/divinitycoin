// app/api/refund-request/route.ts
// User refund request API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getStripeClient } from '@/lib/stripe';
import { sendWebhook } from '@/lib/partner/webhook';
import { getSessionToken, getCurrentUser } from '@/lib/auth/user';

// GET - List user's refund requests
export async function GET(request: NextRequest) {
  try {
    const sessionToken = await getSessionToken();

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const refundRequests = await prisma.refundRequest.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });

    // Also get eligible transactions for refund
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const eligibleTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.userId,
        type: 'PURCHASE',
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
        // Exclude already refunded or with pending refund requests
        NOT: {
          OR: [
            { status: 'REFUNDED' },
            {
              id: {
                in: await prisma.refundRequest.findMany({
                  where: {
                    userId: session.userId,
                    status: { notIn: ['FAILED', 'REJECTED'] },
                  },
                  select: { transactionId: true },
                }).then(r => r.map(x => x.transactionId)),
              },
            },
          ],
        },
      },
      include: { giftCard: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      refundRequests,
      eligibleTransactions: eligibleTransactions.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        createdAt: t.createdAt,
        giftCard: t.giftCard ? {
          id: t.giftCard.id,
          codeLast4: t.giftCard.codeLast4,
          status: t.giftCard.status,
          redeemedAt: t.giftCard.redeemedAt,
          redeemedOnPlatform: t.giftCard.redeemedOnPlatform,
        } : null,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch refund requests', { error });
    return NextResponse.json({ error: 'Failed to fetch refund requests' }, { status: 500 });
  }
}

// POST - Submit a refund request
export async function POST(request: NextRequest) {
  try {
    const sessionToken = await getSessionToken();

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const { transactionId, reason } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    // Get the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { giftCard: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify ownership
    if (transaction.userId !== session.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if already refunded
    if (transaction.status === 'REFUNDED') {
      return NextResponse.json({ error: 'Transaction already refunded' }, { status: 400 });
    }

    // Check if transaction is a purchase
    if (transaction.type !== 'PURCHASE') {
      return NextResponse.json({ error: 'Only purchases can be refunded' }, { status: 400 });
    }

    // Check if within 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (transaction.createdAt < thirtyDaysAgo) {
      return NextResponse.json({
        error: 'Refund window expired. Purchases older than 30 days require manual review.',
        expired: true,
      }, { status: 400 });
    }

    // Check for existing pending refund request
    const existingRequest = await prisma.refundRequest.findFirst({
      where: {
        transactionId,
        status: { notIn: ['FAILED', 'REJECTED'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json({
        error: 'A refund request already exists for this transaction',
        existingRequestId: existingRequest.id,
        status: existingRequest.status,
      }, { status: 400 });
    }

    const giftCard = transaction.giftCard;

    // IMPORTANT: We only do full refunds - no partial refunds allowed
    // The refund amount is always the original transaction amount
    const refundAmount = transaction.amount;

    // For redeemed cards, we require the partner to have the full balance available
    // If the user has spent any of the redeemed balance, the refund will be rejected

    // Determine if code was redeemed on a partner platform
    const wasRedeemed = giftCard?.status === 'REDEEMED' && giftCard.redeemedOnPlatform;

    let partnerId: string | null = null;
    let partnerName: string | null = null;
    let partner: { webhookUrl: string | null; webhookSecret: string | null } | null = null;

    if (wasRedeemed && giftCard.partnerId) {
      const partnerData = await prisma.partner.findUnique({
        where: { id: giftCard.partnerId },
        select: { id: true, name: true, webhookUrl: true, webhookSecret: true },
      });
      if (partnerData) {
        partnerId = partnerData.id;
        partnerName = partnerData.name;
        partner = partnerData;
      }
    }

    // Create refund request
    const refundRequest = await prisma.refundRequest.create({
      data: {
        transactionId,
        giftCardId: giftCard?.id,
        userId: session.userId,
        email: session.user.email,
        amount: transaction.amount,
        reason,
        status: wasRedeemed ? 'AWAITING_PARTNER' : 'APPROVED',
        partnerId,
        partnerName,
        originalCardCode: giftCard?.codeLast4,
        redeemedAmount: giftCard ? giftCard.amount : null,
      },
    });

    // If code was NOT redeemed, process refund directly
    if (!wasRedeemed) {
      try {
        const result = await processStripeRefund(refundRequest.id, transaction, giftCard);
        return NextResponse.json({
          success: true,
          refundRequestId: refundRequest.id,
          status: result.status,
          message: 'Refund processed successfully',
        });
      } catch (error) {
        logger.error('Failed to process direct refund', { error, refundRequestId: refundRequest.id });
        return NextResponse.json({
          success: false,
          refundRequestId: refundRequest.id,
          error: 'Failed to process refund. Our team has been notified.',
        }, { status: 500 });
      }
    }

    // Code was redeemed - need to notify partner first
    if (partner?.webhookUrl && partner?.webhookSecret) {
      try {
        const webhookResult = await sendWebhook(
          partner.webhookUrl,
          partner.webhookSecret,
          'refund.request',
          {
            refundId: refundRequest.id,
            amount: Number(transaction.amount),
            originalCardCode: giftCard?.codeLast4 ? `****${giftCard.codeLast4}` : undefined,
            originalTransactionId: transactionId,
            reason: reason || 'Customer requested refund',
          }
        );

        // Update refund request with webhook result
        await prisma.refundRequest.update({
          where: { id: refundRequest.id },
          data: {
            webhookSent: true,
            webhookSentAt: new Date(),
            webhookResponse: {
              success: webhookResult.success,
              statusCode: webhookResult.statusCode,
              responseBody: webhookResult.responseBody,
              durationMs: webhookResult.durationMs,
            },
          },
        });

        if (webhookResult.success) {
          // Parse partner response
          let partnerResponse;
          try {
            partnerResponse = JSON.parse(webhookResult.responseBody || '{}');
          } catch {
            partnerResponse = {};
          }

          if (partnerResponse.success) {
            // Partner successfully deducted balance - process Stripe refund
            await prisma.refundRequest.update({
              where: { id: refundRequest.id },
              data: {
                status: 'APPROVED',
                partnerRefundId: partnerResponse.refundId,
              },
            });

            const result = await processStripeRefund(refundRequest.id, transaction, giftCard);
            return NextResponse.json({
              success: true,
              refundRequestId: refundRequest.id,
              status: result.status,
              message: 'Refund processed successfully',
            });
          } else {
            // Partner rejected - insufficient balance or other error
            await prisma.refundRequest.update({
              where: { id: refundRequest.id },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                failureReason: partnerResponse.error?.message || 'Partner could not process refund',
              },
            });

            return NextResponse.json({
              success: false,
              refundRequestId: refundRequest.id,
              error: partnerResponse.error?.message || 'The partner platform could not process this refund. The redeemed balance may have already been spent.',
              errorCode: partnerResponse.error?.code,
            }, { status: 400 });
          }
        } else {
          // Webhook failed to send - keep as awaiting partner for retry
          logger.error('Failed to send refund webhook to partner', {
            refundRequestId: refundRequest.id,
            partnerId,
            error: webhookResult.error,
          });

          return NextResponse.json({
            success: true,
            refundRequestId: refundRequest.id,
            status: 'AWAITING_PARTNER',
            message: 'Refund request submitted. We are coordinating with the partner platform.',
          });
        }
      } catch (error) {
        logger.error('Error sending refund webhook', { error, refundRequestId: refundRequest.id });
        return NextResponse.json({
          success: true,
          refundRequestId: refundRequest.id,
          status: 'AWAITING_PARTNER',
          message: 'Refund request submitted. We are coordinating with the partner platform.',
        });
      }
    } else {
      // No webhook configured for partner - needs manual review
      await prisma.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: 'PENDING',
          failureReason: 'Partner webhook not configured - requires manual review',
        },
      });

      return NextResponse.json({
        success: true,
        refundRequestId: refundRequest.id,
        status: 'PENDING',
        message: 'Refund request submitted for manual review. This code was redeemed on a partner platform.',
      });
    }
  } catch (error) {
    logger.error('Failed to create refund request', { error });
    return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 });
  }
}

// Helper function to process Stripe refund
async function processStripeRefund(
  refundRequestId: string,
  transaction: { id: string; stripePaymentIntentId: string | null; amount: any },
  giftCard: { id: string } | null
) {
  if (!transaction.stripePaymentIntentId) {
    await prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'No Stripe payment intent found',
      },
    });
    throw new Error('No Stripe payment intent found');
  }

  await prisma.refundRequest.update({
    where: { id: refundRequestId },
    data: { status: 'PROCESSING' },
  });

  try {
    const stripe = await getStripeClient();

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
    });

    // Update transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'REFUNDED',
        stripeRefundId: refund.id,
      },
    });

    // Revoke the gift card if it exists
    if (giftCard) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: 'REVOKED' },
      });
    }

    // Create refund transaction record
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    });

    await prisma.transaction.create({
      data: {
        userId: existingTransaction?.userId,
        guestEmail: existingTransaction?.guestEmail,
        type: 'REFUND',
        amount: transaction.amount,
        currency: 'USD',
        status: 'COMPLETED',
        stripeRefundId: refund.id,
        giftCardId: giftCard?.id,
        completedAt: new Date(),
      },
    });

    // Update refund request
    await prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        status: 'COMPLETED',
        stripeRefundId: refund.id,
        processedAt: new Date(),
      },
    });

    return { status: 'COMPLETED', stripeRefundId: refund.id };
  } catch (error: any) {
    await prisma.refundRequest.update({
      where: { id: refundRequestId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: error.message || 'Stripe refund failed',
      },
    });
    throw error;
  }
}
