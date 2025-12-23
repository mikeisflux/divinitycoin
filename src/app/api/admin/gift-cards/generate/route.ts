// app/api/admin/gift-cards/generate/route.ts
// Manual gift card generation API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { generateGiftCardCode, formatCodeForDisplay, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

  if (!authorized) {
    return response;
  }

  try {
    const { amount, email, sendEmail, notes } = await request.json();

    if (!amount || amount < 5 || amount > 500) {
      return NextResponse.json(
        { error: 'Amount must be between $5 and $500' },
        { status: 400 }
      );
    }

    // Generate code
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);

    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        codeHash,
        codeLast4,
        amount,
        status: 'ACTIVE',
        activatedAt: new Date(),
        purchasedByEmail: email || null,
        metadata: notes ? JSON.stringify({ notes, generatedBy: admin!.id }) : undefined,
      },
    });

    // Send email if requested
    if (sendEmail && email) {
      await sendGiftCardEmail({
        to: email,
        code,
        amount,
      });
    }

    await logAdminAction(
      admin!.id,
      'GIFTCARD_GENERATE',
      'giftCard',
      giftCard.id,
      { amount, email: email || null, sendEmail: !!sendEmail },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      code: formatCodeForDisplay(code),
      giftCard: {
        id: giftCard.id,
        codeLast4: giftCard.codeLast4,
        amount: giftCard.amount,
        status: giftCard.status,
      },
    });
  } catch (error) {
    logger.apiError('Failed to generate gift card:', error);
    return NextResponse.json(
      { error: 'Failed to generate gift card' },
      { status: 500 }
    );
  }
}
