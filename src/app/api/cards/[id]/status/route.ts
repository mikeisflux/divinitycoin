// app/api/cards/[id]/status/route.ts
// Check gift card status by ID

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      );
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      select: {
        id: true,
        codeLast4: true,
        amount: true,
        status: true,
        createdAt: true,
        activatedAt: true,
        redeemedAt: true,
        expiresAt: true,
      },
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: giftCard.id,
      codeLast4: giftCard.codeLast4,
      amount: giftCard.amount,
      status: giftCard.status,
      createdAt: giftCard.createdAt.toISOString(),
      activatedAt: giftCard.activatedAt?.toISOString() || null,
      redeemedAt: giftCard.redeemedAt?.toISOString() || null,
      expiresAt: giftCard.expiresAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error checking card status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
