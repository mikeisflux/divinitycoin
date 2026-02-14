// app/api/admin/users/platform/[platformUserId]/route.ts
// Platform user detail API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { platformUserId: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const { platformUserId } = params;

    // Get credit balance with holds and ledger
    const creditBalance = await prisma.creditBalance.findUnique({
      where: { platformUserId },
      include: {
        holds: {
          orderBy: { createdAt: 'desc' },
        },
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!creditBalance) {
      return NextResponse.json({ error: 'Platform user not found' }, { status: 404 });
    }

    // Get platform user record (has stripe customer ID and email)
    const [platformUser, partnerPayments] = await Promise.all([
      prisma.platformUser.findUnique({
        where: { platformUserId },
      }),
      prisma.pendingPartnerPayment.findMany({
        where: { platformUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Resolve email from multiple sources if CreditBalance.email is null
    let resolvedEmail = creditBalance.email || platformUser?.email || null;

    if (!resolvedEmail) {
      // Check gift card redemptions and partner payments for email
      const [giftCard, payment] = await Promise.all([
        prisma.giftCard.findFirst({
          where: {
            redeemedByPlatformUserId: platformUserId,
            redeemedByEmail: { not: null },
          },
          select: { redeemedByEmail: true },
        }),
        prisma.pendingPartnerPayment.findFirst({
          where: { platformUserId },
          select: { email: true },
        }),
      ]);
      resolvedEmail = giftCard?.redeemedByEmail || payment?.email || null;
    }

    const resolvedCreditBalance = {
      ...creditBalance,
      email: resolvedEmail,
    };

    return NextResponse.json({
      creditBalance: resolvedCreditBalance,
      platformUser,
      partnerPayments,
    });
  } catch (error) {
    logger.apiError('/api/admin/users/platform/[id]', error);
    return NextResponse.json({ error: 'Failed to fetch platform user' }, { status: 500 });
  }
}
