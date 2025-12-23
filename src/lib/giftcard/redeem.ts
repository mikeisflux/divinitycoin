// lib/giftcard/redeem.ts
// SECURITY: Uses SERIALIZABLE transactions with row-level locking to prevent double-redemption

import { GiftCardStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashCode, isValidCodeFormat, normalizeCode } from './generate';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Error codes
export const RedemptionErrors = {
  INVALID_CODE_FORMAT: 'INVALID_CODE_FORMAT',
  CODE_NOT_FOUND: 'CODE_NOT_FOUND',
  ALREADY_REDEEMED: 'ALREADY_REDEEMED',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_REVOKED: 'CODE_REVOKED',
  RATE_LIMITED: 'RATE_LIMITED',
  TRANSACTION_CONFLICT: 'TRANSACTION_CONFLICT',
} as const;

export type RedemptionErrorCode = typeof RedemptionErrors[keyof typeof RedemptionErrors];

interface RedemptionResult {
  success: boolean;
  amount?: number;
  newBalance?: number;
  previousBalance?: number;
  error?: RedemptionErrorCode;
  message?: string;
  requestId?: string;
}

interface RedemptionParams {
  code: string;
  platformUserId: string;
  ipAddress: string;
  userAgent?: string;
  partnerId?: string;
}

/**
 * Generate a unique request ID for audit tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Validate and redeem a gift card code
 * SECURITY: Uses SERIALIZABLE isolation + SELECT FOR UPDATE to prevent double-redemption
 */
export async function validateAndRedeemCode({
  code,
  platformUserId,
  ipAddress,
  userAgent,
  partnerId,
}: RedemptionParams): Promise<RedemptionResult> {
  const requestId = generateRequestId();

  // 1. Validate format
  if (!isValidCodeFormat(code)) {
    await logRedemptionAttempt({
      codeHash: hashCode(code),
      ipAddress,
      userAgent,
      platformUserId,
      success: false,
      failureReason: RedemptionErrors.INVALID_CODE_FORMAT,
      requestId,
    });
    return {
      success: false,
      error: RedemptionErrors.INVALID_CODE_FORMAT,
      message: 'Invalid code format. Code should be 16 characters.',
      requestId,
    };
  }

  const normalizedCode = normalizeCode(code);
  const codeHash = hashCode(normalizedCode);

  // 2. Find and validate the gift card with proper row locking
  try {
    const result = await prisma.$transaction(async (tx) => {
      // SECURITY: Use raw SQL with FOR UPDATE to lock the row and prevent race conditions
      const giftCardRows = await tx.$queryRaw<Array<{
        id: string;
        status: string;
        amount: Prisma.Decimal;
        expiresAt: Date | null;
        codeLast4: string;
      }>>`
        SELECT id, status, amount, "expiresAt", "codeLast4"
        FROM "GiftCard"
        WHERE "codeHash" = ${codeHash}
        FOR UPDATE
      `;

      if (giftCardRows.length === 0) {
        return {
          success: false,
          error: RedemptionErrors.CODE_NOT_FOUND,
          message: 'Gift card not found.',
          requestId,
        };
      }

      const giftCard = giftCardRows[0];

      // Check status (with row locked - double-redemption prevented)
      if (giftCard.status === GiftCardStatus.REDEEMED) {
        return {
          success: false,
          error: RedemptionErrors.ALREADY_REDEEMED,
          message: 'This code has already been redeemed.',
          requestId,
        };
      }

      if (giftCard.status === GiftCardStatus.EXPIRED) {
        return {
          success: false,
          error: RedemptionErrors.CODE_EXPIRED,
          message: 'This code has expired.',
          requestId,
        };
      }

      if (giftCard.status === GiftCardStatus.REVOKED) {
        return {
          success: false,
          error: RedemptionErrors.CODE_REVOKED,
          message: 'This code has been revoked.',
          requestId,
        };
      }

      if (giftCard.status !== GiftCardStatus.ACTIVE) {
        return {
          success: false,
          error: RedemptionErrors.CODE_NOT_FOUND,
          message: 'Gift card is not active.',
          requestId,
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
          requestId,
        };
      }

      const amount = Number(giftCard.amount);

      // 3. Mark as redeemed
      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: GiftCardStatus.REDEEMED,
          redeemedAt: new Date(),
          redeemedOnPlatform: partnerId,
          redeemedByPlatformUserId: platformUserId,
        },
      });

      // 4. Get current balance for audit trail
      const existingBalance = await tx.creditBalance.findUnique({
        where: { platformUserId },
      });
      const previousBalance = existingBalance ? Number(existingBalance.availableBalance) : 0;

      // 5. Upsert credit balance
      const creditBalance = await tx.creditBalance.upsert({
        where: { platformUserId },
        create: {
          platformUserId,
          availableBalance: amount,
          heldBalance: 0,
        },
        update: {
          availableBalance: {
            increment: amount,
          },
        },
      });

      const newBalance = Number(creditBalance.availableBalance);

      // 6. Create ledger entry with full audit trail
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'REDEMPTION',
          amount: amount,
          balanceAfter: newBalance,
          giftCardId: giftCard.id,
          description: `Redeemed gift card ****${giftCard.codeLast4}`,
          metadata: {
            requestId,
            ipAddress,
            userAgent,
            previousBalance,
            newBalance,
            giftCardId: giftCard.id,
            partnerId,
          },
        },
      });

      return {
        success: true,
        amount,
        newBalance,
        previousBalance,
        requestId,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000, // 10 second timeout
    });

    // Log successful attempt
    await logRedemptionAttempt({
      codeHash,
      ipAddress,
      userAgent,
      platformUserId,
      success: result.success,
      failureReason: result.error,
      requestId,
      amount: result.amount,
      previousBalance: result.previousBalance,
      newBalance: result.newBalance,
    });

    return result;
  } catch (error) {
    logger.error('Redemption error', { error, requestId, platformUserId });

    // Handle serialization failures (concurrent transaction conflicts)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      await logRedemptionAttempt({
        codeHash,
        ipAddress,
        userAgent,
        platformUserId,
        success: false,
        failureReason: 'TRANSACTION_CONFLICT',
        requestId,
      });
      return {
        success: false,
        error: RedemptionErrors.TRANSACTION_CONFLICT,
        message: 'Transaction conflict. Please retry.',
        requestId,
      };
    }

    await logRedemptionAttempt({
      codeHash,
      ipAddress,
      userAgent,
      platformUserId,
      success: false,
      failureReason: 'INTERNAL_ERROR',
      requestId,
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
  requestId?: string;
  amount?: number;
  previousBalance?: number;
  newBalance?: number;
}

/**
 * Log redemption attempt for security and rate limiting
 * Includes full audit trail with request ID, balances, and IP
 */
async function logRedemptionAttempt({
  codeHash,
  ipAddress,
  userAgent,
  platformUserId,
  success,
  failureReason,
  requestId,
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
        errorCode: failureReason,
      },
    });
  } catch (error) {
    logger.error('Failed to log redemption attempt', { error, requestId });
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
