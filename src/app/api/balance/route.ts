// app/api/balance/route.ts
// Get credit balance for authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find session and user
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get credit balance
    const balance = await prisma.creditBalance.findFirst({
      where: {
        OR: [
          { userId: session.userId },
          { email: session.user.email },
        ]
      },
      include: {
        holds: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            amount: true,
            pledgeId: true,
            projectId: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!balance) {
      return NextResponse.json({
        available: 0,
        held: 0,
        total: 0,
        holds: [],
      });
    }

    return NextResponse.json({
      available: Number(balance.availableBalance),
      held: Number(balance.heldBalance),
      total: Number(balance.availableBalance) + Number(balance.heldBalance),
      holds: balance.holds.map((hold: { id: string; amount: unknown; pledgeId: string | null; projectId: string | null; expiresAt: Date | null }) => ({
        id: hold.id,
        amount: Number(hold.amount),
        pledgeId: hold.pledgeId,
        projectId: hold.projectId,
        expiresAt: hold.expiresAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
