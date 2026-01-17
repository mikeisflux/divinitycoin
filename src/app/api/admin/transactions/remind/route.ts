// app/api/admin/transactions/remind/route.ts
// Send reminder emails to users with unredeemed gift cards

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { sendRedemptionReminderEmail } from '@/lib/email/sendRedemptionReminder';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    // Find all ACTIVE gift cards that haven't been redeemed
    const unredeemedCards = await prisma.giftCard.findMany({
      where: {
        status: 'ACTIVE',
        redeemedAt: null,
      },
      include: {
        purchaser: {
          select: { email: true, name: true },
        },
        partner: {
          select: { name: true },
        },
      },
    });

    if (unredeemedCards.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unredeemed gift cards found',
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{
      cardId: string;
      email: string;
      status: 'sent' | 'failed' | 'no_email';
      error?: string;
    }> = [];

    for (const card of unredeemedCards) {
      // Get email from purchaser or purchasedByEmail
      const email = card.purchaser?.email || card.purchasedByEmail;
      const name = card.purchaser?.name || undefined;

      if (!email) {
        results.push({
          cardId: card.id,
          email: 'N/A',
          status: 'no_email',
        });
        continue;
      }

      try {
        const result = await sendRedemptionReminderEmail({
          to: email,
          toName: name,
          amount: Number(card.amount),
          codeLast4: card.codeLast4,
          partnerName: card.partner?.name,
        });

        if (result.success) {
          sent++;
          results.push({
            cardId: card.id,
            email,
            status: 'sent',
          });
        } else {
          failed++;
          results.push({
            cardId: card.id,
            email,
            status: 'failed',
            error: result.error,
          });
        }
      } catch (error) {
        failed++;
        results.push({
          cardId: card.id,
          email,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Redemption reminder emails sent', { sent, failed, total: unredeemedCards.length });

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} reminder emails${failed > 0 ? `, ${failed} failed` : ''}`,
      total: unredeemedCards.length,
      sent,
      failed,
      results,
    });
  } catch (error) {
    logger.error('Failed to send reminder emails', { error });
    return NextResponse.json(
      { success: false, message: 'Failed to send reminder emails' },
      { status: 500 }
    );
  }
}
