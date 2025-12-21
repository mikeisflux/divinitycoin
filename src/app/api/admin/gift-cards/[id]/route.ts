// app/api/admin/gift-cards/[id]/route.ts
// Gift card detail and actions API

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
    console.error('Failed to fetch gift card:', error);
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
    const { action } = await request.json();

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
  } catch (error) {
    console.error('Failed to update gift card:', error);
    return NextResponse.json({ error: 'Failed to update gift card' }, { status: 500 });
  }
}
