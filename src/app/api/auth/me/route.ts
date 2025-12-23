// app/api/auth/me/route.ts
// Get current user endpoint

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/user';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user's purchase history
    const purchases = await prisma.giftCard.findMany({
      where: {
        OR: [
          { purchaserId: user.id },
          { purchasedByEmail: user.email },
        ],
        status: { not: 'PENDING' },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get user's credit balance if linked
    const creditBalance = await prisma.creditBalance.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      purchases: purchases.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
        codeLast4: p.codeLast4,
      })),
      creditBalance: creditBalance ? {
        available: Number(creditBalance.availableBalance),
        held: Number(creditBalance.heldBalance),
      } : null,
    });
  } catch (error) {
    logger.apiError('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
