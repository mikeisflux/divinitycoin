// app/api/admin/gift-cards/[id]/resend/route.ts
// Resend gift card code email - generates a NEW code for security

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: params.id },
    });

    if (!giftCard) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    }

    if (giftCard.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Can only resend email for active gift cards' }, { status: 400 });
    }

    const recipientEmail = giftCard.purchasedByEmail;

    if (!recipientEmail) {
      return NextResponse.json({ error: 'No email address on file for this gift card' }, { status: 400 });
    }

    // Generate a NEW code (more secure than trying to recover old one)
    const newCode = generateGiftCardCode();
    const newCodeHash = hashCode(newCode);
    const newCodeLast4 = getCodeLast4(newCode);

    // Update the gift card with the new code hash
    await prisma.giftCard.update({
      where: { id: params.id },
      data: {
        codeHash: newCodeHash,
        codeLast4: newCodeLast4,
      },
    });

    // Send the email with the new code
    const result = await sendGiftCardEmail({
      to: recipientEmail,
      code: newCode,
      amount: Number(giftCard.amount),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }

    await logAdminAction(
      admin!.id,
      'GIFTCARD_RESEND_EMAIL',
      'giftCard',
      params.id,
      { recipientEmail, codeRegenerated: true, newCodeLast4 },
      getClientIP(request),
      getUserAgent(request)
    );

    logger.info('Gift card code regenerated and resent', {
      giftCardId: params.id,
      recipientEmail,
      newCodeLast4,
    });

    return NextResponse.json({
      success: true,
      message: 'New code generated and sent to customer',
      newCodeLast4,
    });
  } catch (error) {
    logger.apiError('Failed to resend gift card email:', error);
    return NextResponse.json({ error: 'Failed to resend email' }, { status: 500 });
  }
}
