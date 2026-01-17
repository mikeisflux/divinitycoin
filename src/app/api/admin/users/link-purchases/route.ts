// app/api/admin/users/link-purchases/route.ts
// Link existing guest purchases to user accounts by email

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN']);
  if (!authorized) return response;

  try {
    // Find all gift cards with purchasedByEmail but no purchaserId
    const unlinkedGiftCards = await prisma.giftCard.findMany({
      where: {
        purchaserId: null,
        purchasedByEmail: { not: null },
      },
      select: {
        id: true,
        purchasedByEmail: true,
      },
    });

    // Find all transactions with guestEmail but no userId
    const unlinkedTransactions = await prisma.transaction.findMany({
      where: {
        userId: null,
        guestEmail: { not: null },
      },
      select: {
        id: true,
        guestEmail: true,
      },
    });

    // Get unique emails
    const emails = new Set<string>();
    unlinkedGiftCards.forEach(gc => gc.purchasedByEmail && emails.add(gc.purchasedByEmail.toLowerCase()));
    unlinkedTransactions.forEach(tx => tx.guestEmail && emails.add(tx.guestEmail.toLowerCase()));

    // Find users by email
    const users = await prisma.user.findMany({
      where: {
        email: { in: Array.from(emails) },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const userByEmail = new Map(users.map(u => [u.email.toLowerCase(), u.id]));

    let linkedGiftCards = 0;
    let linkedTransactions = 0;

    // Link gift cards
    for (const gc of unlinkedGiftCards) {
      if (gc.purchasedByEmail) {
        const userId = userByEmail.get(gc.purchasedByEmail.toLowerCase());
        if (userId) {
          await prisma.giftCard.update({
            where: { id: gc.id },
            data: { purchaserId: userId },
          });
          linkedGiftCards++;
        }
      }
    }

    // Link transactions
    for (const tx of unlinkedTransactions) {
      if (tx.guestEmail) {
        const userId = userByEmail.get(tx.guestEmail.toLowerCase());
        if (userId) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { userId },
          });
          linkedTransactions++;
        }
      }
    }

    logger.info('Linked purchases to user accounts', {
      linkedGiftCards,
      linkedTransactions,
      totalUnlinkedGiftCards: unlinkedGiftCards.length,
      totalUnlinkedTransactions: unlinkedTransactions.length,
    });

    return NextResponse.json({
      success: true,
      message: `Linked ${linkedGiftCards} gift cards and ${linkedTransactions} transactions to user accounts`,
      linkedGiftCards,
      linkedTransactions,
      totalUnlinkedGiftCards: unlinkedGiftCards.length,
      totalUnlinkedTransactions: unlinkedTransactions.length,
    });
  } catch (error) {
    logger.error('Failed to link purchases', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to link purchases' },
      { status: 500 }
    );
  }
}
