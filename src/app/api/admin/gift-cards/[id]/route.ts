// app/api/admin/gift-cards/[id]/route.ts
// Gift card detail and actions API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: params.id },
      include: {
        purchaser: true,
        redeemedBy: true,
        transactions: true,
      },
    });

    if (!giftCard) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    }

    return NextResponse.json({ giftCard });
  } catch (error) {
    logger.apiError('Failed to fetch gift card:', error);
    return NextResponse.json({ error: 'Failed to fetch gift card' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const body = await request.json();
    const { action, amount, status, expiresAt } = body;

    // If action is provided, handle status change actions
    if (action) {
      let updateData: any = {};

      switch (action) {
        case 'revoke':
          updateData = { status: 'REVOKED' };
          break;
        case 'reactivate':
          updateData = { status: 'ACTIVE' };
          break;
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }

      const giftCard = await prisma.giftCard.update({
        where: { id: params.id },
        data: updateData,
      });

      await logAdminAction(
        admin!.id,
        `GIFTCARD_${action.toUpperCase()}`,
        'giftCard',
        params.id,
        { action },
        getClientIP(request),
        getUserAgent(request)
      );

      return NextResponse.json({ giftCard });
    }

    // Handle direct field updates
    const updateData: any = {};

    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      updateData.amount = numAmount;
    }

    if (status !== undefined) {
      const validStatuses = ['PENDING', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'REVOKED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const giftCard = await prisma.giftCard.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAdminAction(
      admin!.id,
      'GIFTCARD_UPDATE',
      'giftCard',
      params.id,
      { updates: updateData },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ giftCard });
  } catch (error) {
    logger.apiError('Failed to update gift card:', error);
    return NextResponse.json({ error: 'Failed to update gift card' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    // Check if gift card exists
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: params.id },
      include: { transactions: true },
    });

    if (!giftCard) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    }

    // Prevent deletion of redeemed cards
    if (giftCard.status === 'REDEEMED') {
      return NextResponse.json(
        { error: 'Cannot delete redeemed gift cards' },
        { status: 400 }
      );
    }

    // Delete related transactions first
    if (giftCard.transactions.length > 0) {
      await prisma.transaction.deleteMany({
        where: { giftCardId: params.id },
      });
    }

    // Delete the gift card
    await prisma.giftCard.delete({
      where: { id: params.id },
    });

    await logAdminAction(
      admin!.id,
      'GIFTCARD_DELETE',
      'giftCard',
      params.id,
      {
        codeLast4: giftCard.codeLast4,
        amount: giftCard.amount,
        status: giftCard.status,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Failed to delete gift card:', error);
    return NextResponse.json({ error: 'Failed to delete gift card' }, { status: 500 });
  }
}
