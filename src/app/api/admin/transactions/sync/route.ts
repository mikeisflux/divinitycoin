// app/api/admin/transactions/sync/route.ts
// Bulk sync pending transactions with Stripe

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);

  if (!authorized) {
    return response;
  }

  try {
    // Find all pending transactions with Stripe payment intent IDs
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        stripePaymentIntentId: { not: null },
      },
      include: {
        giftCard: true,
      },
    });

    if (pendingTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending transactions to sync',
        synced: 0,
        failed: 0,
        results: [],
      });
    }

    const stripe = await getStripeClient();
    const results: Array<{
      transactionId: string;
      status: 'synced' | 'already_completed' | 'payment_not_succeeded' | 'error';
      stripeStatus?: string;
      error?: string;
    }> = [];

    let syncedCount = 0;
    let failedCount = 0;

    for (const transaction of pendingTransactions) {
      try {
        if (!transaction.stripePaymentIntentId) {
          results.push({
            transactionId: transaction.id,
            status: 'error',
            error: 'No payment intent ID',
          });
          failedCount++;
          continue;
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          results.push({
            transactionId: transaction.id,
            status: 'payment_not_succeeded',
            stripeStatus: paymentIntent.status,
          });
          continue;
        }

        // Payment succeeded on Stripe - complete the transaction
        const email = transaction.guestEmail || paymentIntent.receipt_email || '';
        const partnerId = paymentIntent.metadata?.partnerId || null;

        const code = generateGiftCardCode();
        const codeHash = hashCode(code);
        const codeLast4 = getCodeLast4(code);

        let wasAlreadyCompleted = false;

        try {
          await prisma.$transaction(async (tx) => {
            // Check if already completed
            const fresh = await tx.transaction.findUnique({
              where: { id: transaction.id },
              include: { giftCard: true },
            });

            if (fresh?.status === 'COMPLETED' && fresh.giftCard) {
              wasAlreadyCompleted = true;
              return;
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
              where: { id: transaction.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                giftCardId: newGiftCard.id,
              },
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
                logger.error('Failed to send gift card email during bulk sync', {
                  error: emailError,
                  transactionId: transaction.id,
                });
              }
            }
          }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 10000,
          });
        } catch (txError) {
          if (txError instanceof Prisma.PrismaClientKnownRequestError) {
            // Check if completed by concurrent request
            const existing = await prisma.transaction.findUnique({
              where: { id: transaction.id },
            });
            if (existing?.status === 'COMPLETED') {
              wasAlreadyCompleted = true;
            } else {
              throw txError;
            }
          } else {
            throw txError;
          }
        }

        if (wasAlreadyCompleted) {
          results.push({
            transactionId: transaction.id,
            status: 'already_completed',
          });
        } else {
          results.push({
            transactionId: transaction.id,
            status: 'synced',
            stripeStatus: 'succeeded',
          });
          syncedCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to sync transaction', {
          error,
          transactionId: transaction.id,
        });
        results.push({
          transactionId: transaction.id,
          status: 'error',
          error: errorMessage,
        });
        failedCount++;
      }
    }

    await logAdminAction(
      admin!.id,
      'TRANSACTIONS_BULK_SYNC',
      'transaction',
      'bulk',
      {
        total: pendingTransactions.length,
        synced: syncedCount,
        failed: failedCount,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} transactions`,
      total: pendingTransactions.length,
      synced: syncedCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    logger.apiError('Failed to bulk sync transactions:', error);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
