// app/api/admin/transactions/[id]/route.ts
// Transaction detail and actions API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { sendTransactionReceiptEmail } from '@/lib/email/sendTransactionReceipt';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        giftCard: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    logger.apiError('Failed to fetch transaction:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);

  if (!authorized) {
    return response;
  }

  try {
    const { action } = await request.json();

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { giftCard: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (action === 'refund') {
      if (transaction.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Only completed transactions can be refunded' }, { status: 400 });
      }

      if (transaction.type !== 'PURCHASE') {
        return NextResponse.json({ error: 'Only purchase transactions can be refunded' }, { status: 400 });
      }

      if (!transaction.stripePaymentIntentId) {
        return NextResponse.json({ error: 'No payment intent found for this transaction' }, { status: 400 });
      }

      try {
        const stripe = await getStripeClient();

        // Create refund in Stripe
        const refund = await stripe.refunds.create({
          payment_intent: transaction.stripePaymentIntentId,
        });

        // Update transaction
        await prisma.transaction.update({
          where: { id: params.id },
          data: {
            status: 'REFUNDED',
            stripeRefundId: refund.id,
          },
        });

        // Revoke the gift card if it exists
        if (transaction.giftCardId) {
          await prisma.giftCard.update({
            where: { id: transaction.giftCardId },
            data: { status: 'REVOKED' },
          });
        }

        // Create refund transaction record
        await prisma.transaction.create({
          data: {
            userId: transaction.userId,
            guestEmail: transaction.guestEmail,
            type: 'REFUND',
            amount: transaction.amount,
            currency: transaction.currency,
            status: 'COMPLETED',
            stripeRefundId: refund.id,
            giftCardId: transaction.giftCardId,
            completedAt: new Date(),
          },
        });

        // Get email for refund notification
        const refundEmail = transaction.guestEmail || (transaction.userId ? (await prisma.user.findUnique({ where: { id: transaction.userId } }))?.email : null);

        // Send refund receipt email
        if (refundEmail) {
          try {
            await sendTransactionReceiptEmail({
              to: refundEmail,
              transactionId: params.id,
              amount: Number(transaction.amount),
              type: 'REFUNDED',
              originalDate: transaction.createdAt,
              giftCardLast4: transaction.giftCard?.codeLast4,
            });
          } catch (emailError) {
            logger.error('Failed to send refund receipt email', {
              error: emailError,
              transactionId: params.id,
            });
          }
        }

        await logAdminAction(
          admin!.id,
          'TRANSACTION_REFUND',
          'transaction',
          params.id,
          { refundId: refund.id, amount: Number(transaction.amount) },
          getClientIP(request),
          getUserAgent(request)
        );

        return NextResponse.json({ success: true, refundId: refund.id });
      } catch (stripeError: any) {
        logger.apiError('Stripe refund error:', error);
        return NextResponse.json({
          error: stripeError.message || 'Failed to process refund with Stripe'
        }, { status: 500 });
      }
    }

    if (action === 'send_gift_card_code') {
      if (!transaction.giftCardId) {
        return NextResponse.json({ error: 'No gift card associated with this transaction' }, { status: 400 });
      }

      const giftCard = await prisma.giftCard.findUnique({
        where: { id: transaction.giftCardId },
      });

      if (!giftCard) {
        return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
      }

      if (giftCard.status === 'REVOKED') {
        return NextResponse.json({ error: 'Cannot send code for revoked gift card' }, { status: 400 });
      }

      // Get the email address
      const email = transaction.guestEmail || (transaction.userId ? (await prisma.user.findUnique({ where: { id: transaction.userId } }))?.email : null);

      if (!email) {
        return NextResponse.json({ error: 'No email address found for this transaction' }, { status: 400 });
      }

      // Generate a NEW code (since original is hashed and unrecoverable)
      const newCode = generateGiftCardCode();
      const newCodeHash = hashCode(newCode);
      const newCodeLast4 = getCodeLast4(newCode);

      // Update the gift card with the new code
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: {
          codeHash: newCodeHash,
          codeLast4: newCodeLast4,
        },
      });

      // Send the email with the new code
      const emailResult = await sendGiftCardEmail({
        to: email,
        code: newCode,
        amount: Number(giftCard.amount),
      });

      if (!emailResult.success) {
        logger.error('Failed to send gift card email from admin', {
          error: emailResult.error,
          giftCardId: giftCard.id,
          transactionId: params.id,
        });
        return NextResponse.json({
          error: emailResult.error || 'Failed to send email',
          codeGenerated: true,
          newCodeLast4: newCodeLast4,
        }, { status: 500 });
      }

      await logAdminAction(
        admin!.id,
        'GIFT_CARD_CODE_REGENERATED',
        'giftCard',
        giftCard.id,
        {
          transactionId: params.id,
          email,
          oldCodeLast4: giftCard.codeLast4,
          newCodeLast4: newCodeLast4,
        },
        getClientIP(request),
        getUserAgent(request)
      );

      return NextResponse.json({
        success: true,
        message: `New code generated and sent to ${email}`,
        newCodeLast4: newCodeLast4,
      });
    }

    if (action === 'cancel') {
      if (transaction.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Cannot cancel completed transaction. Use refund instead.' }, { status: 400 });
      }

      if (transaction.status === 'REFUNDED' || transaction.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Transaction already cancelled/refunded' }, { status: 400 });
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
        },
      });

      // Get email for notification
      const email = transaction.guestEmail || (transaction.userId ? (await prisma.user.findUnique({ where: { id: transaction.userId } }))?.email : null);

      // Send cancellation receipt email
      if (email) {
        try {
          await sendTransactionReceiptEmail({
            to: email,
            transactionId: params.id,
            amount: Number(transaction.amount),
            type: 'CANCELLED',
            originalDate: transaction.createdAt,
            giftCardLast4: transaction.giftCard?.codeLast4,
          });
        } catch (emailError) {
          logger.error('Failed to send cancellation receipt email', {
            error: emailError,
            transactionId: params.id,
          });
        }
      }

      await logAdminAction(
        admin!.id,
        'TRANSACTION_CANCELLED',
        'transaction',
        params.id,
        { previousStatus: transaction.status },
        getClientIP(request),
        getUserAgent(request)
      );

      return NextResponse.json({ success: true, message: 'Transaction cancelled' });
    }

    if (action === 'sync_with_stripe') {
      if (!transaction.stripePaymentIntentId) {
        return NextResponse.json({ error: 'No Stripe payment intent associated with this transaction' }, { status: 400 });
      }

      if (transaction.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Transaction is already completed' }, { status: 400 });
      }

      try {
        const stripe = await getStripeClient();
        const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json({
            success: false,
            message: `Stripe payment status is: ${paymentIntent.status}`,
            stripeStatus: paymentIntent.status,
          });
        }

        // Payment succeeded on Stripe - complete the transaction
        const email = transaction.guestEmail || paymentIntent.receipt_email || '';
        const partnerId = paymentIntent.metadata?.partnerId || null;

        const code = generateGiftCardCode();
        const codeHash = hashCode(code);
        const codeLast4 = getCodeLast4(code);

        const giftCard = await prisma.$transaction(async (tx) => {
          // Check if already completed
          const fresh = await tx.transaction.findUnique({
            where: { id: params.id },
            include: { giftCard: true },
          });

          if (fresh?.status === 'COMPLETED' && fresh.giftCard) {
            return fresh.giftCard;
          }

          // Create gift card
          const newGiftCard = await tx.giftCard.create({
            data: {
              codeHash,
              codeLast4,
              amount: transaction.amount,
              currency: 'USD',
              status: 'ACTIVE',
              purchasedByEmail: email,
              activatedAt: new Date(),
              partnerId: partnerId || undefined,
            },
          });

          // Update transaction
          await tx.transaction.update({
            where: { id: params.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              giftCardId: newGiftCard.id,
            },
          });

          return newGiftCard;
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        });

        // Send gift card email
        if (email) {
          try {
            await sendGiftCardEmail({
              to: email,
              code: code,
              amount: Number(transaction.amount),
            });
          } catch (emailError) {
            logger.error('Failed to send gift card email during sync', {
              error: emailError,
              giftCardId: giftCard.id,
            });
          }
        }

        await logAdminAction(
          admin!.id,
          'TRANSACTION_SYNCED',
          'transaction',
          params.id,
          { giftCardId: giftCard.id, stripeStatus: paymentIntent.status },
          getClientIP(request),
          getUserAgent(request)
        );

        return NextResponse.json({
          success: true,
          message: 'Transaction synced and completed',
          giftCardId: giftCard.id,
          codeLast4: giftCard.codeLast4,
        });
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
        logger.error('Failed to sync with Stripe', { error: stripeError, transactionId: params.id });
        return NextResponse.json({
          error: `Failed to sync with Stripe: ${errorMessage}`,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.apiError('Failed to process transaction action:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
