// lib/giftcard/redeem.ts

import { PrismaClient, GiftCardStatus } from '@prisma/client';
import { hashCode, isValidCodeFormat, normalizeCode } from './generate';

const prisma = new PrismaClient();

// Error codes
export const RedemptionErrors = {
  INVALID_CODE_FORMAT: 'INVALID_CODE_FORMAT',
  CODE_NOT_FOUND: 'CODE_NOT_FOUND',
  ALREADY_REDEEMED: 'ALREADY_REDEEMED',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_REVOKED: 'CODE_REVOKED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type RedemptionErrorCode = typeof RedemptionErrors[keyof typeof RedemptionErrors];

interface RedemptionResult {
  success: boolean;
  amount?: number;
  newBalance?: number;
  error?: RedemptionErrorCode;
  message?: string;
}

interface RedemptionParams {
  code: string;
  platformUserId: string;
  ipAddress: string;
  userAgent?: string;
  partnerId?: string;
}

/**
 * Validate and redeem a gift card code
 * This is an atomic operation that prevents double-spending
 */
export async function validateAndRedeemCode({
  code,
  platformUserId,
  ipAddress,
  userAgent,
  partnerId,
}: RedemptionParams): Promise<RedemptionResult> {
  // 1. Validate format
  if (!isValidCodeFormat(code)) {
    await logRedemptionAttempt({
      codeHash: hashCode(code),
      ipAddress,
      userAgent,
      platformUserId,
      success: false,
      failureReason: RedemptionErrors.INVALID_CODE_FORMAT,
    });
    return {
      success: false,
      error: RedemptionErrors.INVALID_CODE_FORMAT,
      message: 'Invalid code format. Code should be 16 characters.',
    };
  }

  const normalizedCode = normalizeCode(code);
  const codeHash = hashCode(normalizedCode);

  // 2. Find and validate the gift card (with row locking)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the row for update
      const giftCard = await tx.giftCard.findUnique({
        where: { codeHash },
      });

      if (!giftCard) {
        return {
          success: false,
          error: RedemptionErrors.CODE_NOT_FOUND,
          message: 'Gift card not found.',
        };
      }

      // Check status
      if (giftCard.status === GiftCardStatus.REDEEMED) {
        return {
          success: false,
          error: RedemptionErrors.ALREADY_REDEEMED,
          message: 'This code has already been redeemed.',
        };
      }

      if (giftCard.status === GiftCardStatus.EXPIRED) {
        return {
          success: false,
          error: RedemptionErrors.CODE_EXPIRED,
          message: 'This code has expired.',
        };
      }

      if (giftCard.status === GiftCardStatus.REVOKED) {
        return {
          success: false,
          error: RedemptionErrors.CODE_REVOKED,
          message: 'This code has been revoked.',
        };
      }

      if (giftCard.status !== GiftCardStatus.ACTIVE) {
        return {
          success: false,
          error: RedemptionErrors.CODE_NOT_FOUND,
          message: 'Gift card is not active.',
        };
      }

      // Check expiry
      if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
        await tx.giftCard.update({
          where: { id: giftCard.id },
          data: { status: GiftCardStatus.EXPIRED },
        });
        return {
          success: false,
          error: RedemptionErrors.CODE_EXPIRED,
          message: 'This code has expired.',
        };
      }

      // 3. Mark as redeemed
      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: GiftCardStatus.REDEEMED,
          redeemedAt: new Date(),
          redeemedOnPlatform: partnerId,
        },
      });

      // 4. Upsert credit balance
      const creditBalance = await tx.creditBalance.upsert({
        where: { platformUserId },
        create: {
          platformUserId,
          availableBalance: giftCard.amount,
          heldBalance: 0,
        },
        update: {
          availableBalance: {
            increment: giftCard.amount,
          },
        },
      });

      // 5. Create ledger entry
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'REDEMPTION',
          amount: giftCard.amount,
          balanceAfter: creditBalance.availableBalance,
          giftCardId: giftCard.id,
          description: `Redeemed gift card ****${giftCard.codeLast4}`,
        },
      });

      return {
        success: true,
        amount: Number(giftCard.amount),
        newBalance: Number(creditBalance.availableBalance),
      };
    });

    // Log successful attempt
    await logRedemptionAttempt({
      codeHash,
      ipAddress,
      userAgent,
      platformUserId,
      success: result.success,
      failureReason: result.error,
    });

    return result;
  } catch (error) {
    console.error('Redemption error:', error);
    await logRedemptionAttempt({
      codeHash,
      ipAddress,
      userAgent,
      platformUserId,
      success: false,
      failureReason: 'INTERNAL_ERROR',
    });
    throw error;
  }
}

interface LogAttemptParams {
  codeHash: string;
  ipAddress: string;
  userAgent?: string;
  platformUserId?: string;
  success: boolean;
  failureReason?: string;
}

/**
 * Log redemption attempt for security and rate limiting
 */
async function logRedemptionAttempt({
  codeHash,
  ipAddress,
  userAgent,
  platformUserId,
  success,
  failureReason,
}: LogAttemptParams): Promise<void> {
  try {
    await prisma.redemptionAttempt.create({
      data: {
        codeHashAttempt: codeHash,
        ipAddress,
        userAgent,
        platformUserId,
        success,
        failureReason,
      },
    });
  } catch (error) {
    console.error('Failed to log redemption attempt:', error);
  }
}

/**
 * Check if code is valid without redeeming
 */
export async function checkCodeStatus(code: string): Promise<{
  valid: boolean;
  status?: GiftCardStatus;
  amount?: number;
  error?: RedemptionErrorCode;
}> {
  if (!isValidCodeFormat(code)) {
    return { valid: false, error: RedemptionErrors.INVALID_CODE_FORMAT };
  }

  const codeHash = hashCode(normalizeCode(code));

  const giftCard = await prisma.giftCard.findUnique({
    where: { codeHash },
    select: { status: true, amount: true, expiresAt: true },
  });

  if (!giftCard) {
    return { valid: false, error: RedemptionErrors.CODE_NOT_FOUND };
  }

  if (giftCard.status === GiftCardStatus.REDEEMED) {
    return { valid: false, status: giftCard.status, error: RedemptionErrors.ALREADY_REDEEMED };
  }

  if (giftCard.status === GiftCardStatus.EXPIRED ||
      (giftCard.expiresAt && giftCard.expiresAt < new Date())) {
    return { valid: false, status: GiftCardStatus.EXPIRED, error: RedemptionErrors.CODE_EXPIRED };
  }

  if (giftCard.status === GiftCardStatus.REVOKED) {
    return { valid: false, status: giftCard.status, error: RedemptionErrors.CODE_REVOKED };
  }

  if (giftCard.status === GiftCardStatus.ACTIVE) {
    return { valid: true, status: giftCard.status, amount: Number(giftCard.amount) };
  }

  return { valid: false };
}
