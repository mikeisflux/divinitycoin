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

    // Get platform user record (has stripe customer ID)
    const platformUser = await prisma.platformUser.findUnique({
      where: { platformUserId },
    });

    // Get all partner payments for this platform user
    const partnerPayments = await prisma.pendingPartnerPayment.findMany({
      where: { platformUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      creditBalance,
      platformUser,
      partnerPayments,
    });
  } catch (error) {
    logger.apiError('/api/admin/users/platform/[id]', error);
    return NextResponse.json({ error: 'Failed to fetch platform user' }, { status: 500 });
  }
}
