// lib/credits/holds.ts
// SECURITY: Uses SERIALIZABLE transactions with row-level locking to prevent race conditions

import { HoldStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Error codes
export const HoldErrors = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  HOLD_NOT_FOUND: 'HOLD_NOT_FOUND',
  HOLD_NOT_ACTIVE: 'HOLD_NOT_ACTIVE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  DUPLICATE_HOLD: 'DUPLICATE_HOLD',
  TRANSACTION_CONFLICT: 'TRANSACTION_CONFLICT',
} as const;

export type HoldErrorCode = typeof HoldErrors[keyof typeof HoldErrors];

interface HoldResult {
  success: boolean;
  holdId?: string;
  error?: HoldErrorCode;
  message?: string;
  requestId?: string;
}

interface CaptureResult {
  success: boolean;
  amount?: number;
  error?: HoldErrorCode;
  message?: string;
  requestId?: string;
}

interface PlaceHoldParams {
  platformUserId: string;
  amount: number;
  pledgeId: string;
  projectId: string;
  expiresAt?: Date;
  ipAddress?: string;
}

/**
 * Generate a unique request ID for audit tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Place a hold on credits for a pledge
 * SECURITY: Uses SERIALIZABLE isolation + SELECT FOR UPDATE to prevent double-spend
 */
export async function placeHold({
  platformUserId,
  amount,
  pledgeId,
  projectId,
  expiresAt,
  ipAddress,
}: PlaceHoldParams): Promise<HoldResult> {
  const requestId = generateRequestId();

  if (amount <= 0) {
    return {
      success: false,
      error: HoldErrors.INVALID_AMOUNT,
      message: 'Amount must be positive.',
      requestId,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate hold first (idempotency)
      const existingHold = await tx.creditHold.findUnique({
        where: { pledgeId },
      });

      if (existingHold) {
        if (existingHold.status === HoldStatus.ACTIVE) {
          return {
            success: true,
            holdId: existingHold.id,
            message: 'Hold already exists for this pledge.',
            requestId,
          };
        }
        return {
          success: false,
          error: HoldErrors.DUPLICATE_HOLD,
          message: `A hold already exists for this pledge with status: ${existingHold.status}`,
          requestId,
        };
      }

      // SECURITY: Use raw SQL with FOR UPDATE to lock the row and prevent race conditions
      const balanceRows = await tx.$queryRaw<Array<{
        id: string;
        availableBalance: Prisma.Decimal;
        heldBalance: Prisma.Decimal;
      }>>`
        SELECT id, "availableBalance", "heldBalance"
        FROM "CreditBalance"
        WHERE "platformUserId" = ${platformUserId}
        FOR UPDATE
      `;

      if (balanceRows.length === 0) {
        return {
          success: false,
          error: HoldErrors.USER_NOT_FOUND,
          message: 'User credit balance not found.',
          requestId,
        };
      }

      const creditBalance = balanceRows[0];
      const previousBalance = Number(creditBalance.availableBalance);

      // Check available balance (now with row locked - race condition prevented)
      if (previousBalance < amount) {
        return {
          success: false,
          error: HoldErrors.INSUFFICIENT_BALANCE,
          message: `Insufficient balance. Available: ${previousBalance}, Required: ${amount}`,
          requestId,
        };
      }

      // Create the hold
      const hold = await tx.creditHold.create({
        data: {
          creditBalanceId: creditBalance.id,
          amount,
          pledgeId,
          projectId,
          status: HoldStatus.ACTIVE,
          expiresAt,
        },
      });

      // Update balances atomically
      const updatedBalance = await tx.creditBalance.update({
        where: { id: creditBalance.id },
        data: {
          availableBalance: { decrement: amount },
          heldBalance: { increment: amount },
        },
      });

      // Create ledger entry with full audit trail
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_PLACED',
          amount: -amount,
          balanceAfter: updatedBalance.availableBalance,
          holdId: hold.id,
          description: `Hold placed for pledge ${pledgeId}`,
          metadata: {
            requestId,
            ipAddress,
            previousBalance,
            newBalance: Number(updatedBalance.availableBalance),
            pledgeId,
            projectId,
          },
        },
      });

      return {
        success: true,
        holdId: hold.id,
        requestId,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000, // 10 second timeout
    });

    return result;
  } catch (error) {
    logger.error('Place hold error', { error, requestId, platformUserId, amount, pledgeId });

    // Handle serialization failures (concurrent transaction conflicts)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return {
        success: false,
        error: HoldErrors.TRANSACTION_CONFLICT,
        message: 'Transaction conflict. Please retry.',
        requestId,
      };
    }

    throw error;
  }
}

/**
 * Release a hold (project failed or pledge cancelled)
 * SECURITY: Uses SERIALIZABLE isolation + SELECT FOR UPDATE to prevent race conditions
 */
export async function releaseHold(pledgeId: string, ipAddress?: string): Promise<CaptureResult> {
  const requestId = generateRequestId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // SECURITY: Lock the hold row with FOR UPDATE
      const holdRows = await tx.$queryRaw<Array<{
        id: string;
        creditBalanceId: string;
        amount: Prisma.Decimal;
        status: string;
      }>>`
        SELECT id, "creditBalanceId", amount, status
        FROM "CreditHold"
        WHERE "pledgeId" = ${pledgeId}
        FOR UPDATE
      `;

      if (holdRows.length === 0) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_FOUND,
          message: 'Hold not found for this pledge.',
          requestId,
        };
      }

      const hold = holdRows[0];

      if (hold.status !== HoldStatus.ACTIVE) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_ACTIVE,
          message: `Hold is not active. Current status: ${hold.status}`,
          requestId,
        };
      }

      const amount = Number(hold.amount);

      // Update hold status
      await tx.creditHold.update({
        where: { id: hold.id },
        data: {
          status: HoldStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      // Return credits to available balance
      const creditBalance = await tx.creditBalance.update({
        where: { id: hold.creditBalanceId },
        data: {
          availableBalance: { increment: amount },
          heldBalance: { decrement: amount },
        },
      });

      // Create ledger entry with audit trail
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_RELEASED',
          amount: amount,
          balanceAfter: creditBalance.availableBalance,
          holdId: hold.id,
          description: `Hold released for pledge ${pledgeId}`,
          metadata: {
            requestId,
            ipAddress,
            releasedAmount: amount,
            newAvailableBalance: Number(creditBalance.availableBalance),
          },
        },
      });

      return {
        success: true,
        amount,
        requestId,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });

    return result;
  } catch (error) {
    logger.error('Release hold error', { error, requestId, pledgeId });

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return {
        success: false,
        error: HoldErrors.TRANSACTION_CONFLICT,
        message: 'Transaction conflict. Please retry.',
        requestId,
      };
    }

    throw error;
  }
}

/**
 * Capture a hold (project funded successfully)
 * SECURITY: Uses SERIALIZABLE isolation + SELECT FOR UPDATE to prevent race conditions
 */
export async function captureHold(pledgeId: string, ipAddress?: string): Promise<CaptureResult> {
  const requestId = generateRequestId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // SECURITY: Lock the hold row with FOR UPDATE
      const holdRows = await tx.$queryRaw<Array<{
        id: string;
        creditBalanceId: string;
        amount: Prisma.Decimal;
        status: string;
      }>>`
        SELECT id, "creditBalanceId", amount, status
        FROM "CreditHold"
        WHERE "pledgeId" = ${pledgeId}
        FOR UPDATE
      `;

      if (holdRows.length === 0) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_FOUND,
          message: 'Hold not found for this pledge.',
          requestId,
        };
      }

      const hold = holdRows[0];

      if (hold.status !== HoldStatus.ACTIVE) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_ACTIVE,
          message: `Hold is not active. Current status: ${hold.status}`,
          requestId,
        };
      }

      const amount = Number(hold.amount);

      // Update hold status
      await tx.creditHold.update({
        where: { id: hold.id },
        data: {
          status: HoldStatus.CAPTURED,
          capturedAt: new Date(),
        },
      });

      // Deduct from held balance (credits are transferred to creator)
      const creditBalance = await tx.creditBalance.update({
        where: { id: hold.creditBalanceId },
        data: {
          heldBalance: { decrement: amount },
        },
      });

      // Create ledger entry with audit trail
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_CAPTURED',
          amount: -amount,
          balanceAfter: creditBalance.availableBalance,
          holdId: hold.id,
          description: `Hold captured for pledge ${pledgeId}`,
          metadata: {
            requestId,
            ipAddress,
            capturedAmount: amount,
            remainingHeldBalance: Number(creditBalance.heldBalance),
          },
        },
      });

      return {
        success: true,
        amount,
        requestId,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    });

    return result;
  } catch (error) {
    logger.error('Capture hold error', { error, requestId, pledgeId });

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return {
        success: false,
        error: HoldErrors.TRANSACTION_CONFLICT,
        message: 'Transaction conflict. Please retry.',
        requestId,
      };
    }

    throw error;
  }
}

/**
 * Get user's credit balance
 */
export async function getBalance(platformUserId: string): Promise<{
  available: number;
  held: number;
  total: number;
  holds: Array<{
    pledgeId: string;
    projectId: string;
    amount: number;
    createdAt: Date;
  }>;
} | null> {
  const creditBalance = await prisma.creditBalance.findUnique({
    where: { platformUserId },
    include: {
      holds: {
        where: { status: HoldStatus.ACTIVE },
        select: {
          pledgeId: true,
          projectId: true,
          amount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!creditBalance) {
    return null;
  }

  const available = Number(creditBalance.availableBalance);
  const held = Number(creditBalance.heldBalance);

  return {
    available,
    held,
    total: available + held,
    holds: creditBalance.holds.map((h) => ({
      pledgeId: h.pledgeId,
      projectId: h.projectId,
      amount: Number(h.amount),
      createdAt: h.createdAt,
    })),
  };
}
