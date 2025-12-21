// lib/credits/holds.ts

import { PrismaClient, HoldStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Error codes
export const HoldErrors = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  HOLD_NOT_FOUND: 'HOLD_NOT_FOUND',
  HOLD_NOT_ACTIVE: 'HOLD_NOT_ACTIVE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const;

export type HoldErrorCode = typeof HoldErrors[keyof typeof HoldErrors];

interface HoldResult {
  success: boolean;
  holdId?: string;
  error?: HoldErrorCode;
  message?: string;
}

interface CaptureResult {
  success: boolean;
  amount?: number;
  error?: HoldErrorCode;
  message?: string;
}

interface PlaceHoldParams {
  platformUserId: string;
  amount: number;
  pledgeId: string;
  projectId: string;
  expiresAt?: Date;
}

/**
 * Place a hold on credits for a pledge
 */
export async function placeHold({
  platformUserId,
  amount,
  pledgeId,
  projectId,
  expiresAt,
}: PlaceHoldParams): Promise<HoldResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: HoldErrors.INVALID_AMOUNT,
      message: 'Amount must be positive.',
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get or create credit balance
      let creditBalance = await tx.creditBalance.findUnique({
        where: { platformUserId },
      });

      if (!creditBalance) {
        return {
          success: false,
          error: HoldErrors.USER_NOT_FOUND,
          message: 'User credit balance not found.',
        };
      }

      // Check available balance
      if (Number(creditBalance.availableBalance) < amount) {
        return {
          success: false,
          error: HoldErrors.INSUFFICIENT_BALANCE,
          message: `Insufficient balance. Available: ${creditBalance.availableBalance}, Required: ${amount}`,
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

      // Update balances
      creditBalance = await tx.creditBalance.update({
        where: { id: creditBalance.id },
        data: {
          availableBalance: { decrement: amount },
          heldBalance: { increment: amount },
        },
      });

      // Create ledger entry
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_PLACED',
          amount: -amount, // Negative because it reduces available
          balanceAfter: creditBalance.availableBalance,
          holdId: hold.id,
          description: `Hold placed for pledge ${pledgeId}`,
        },
      });

      return {
        success: true,
        holdId: hold.id,
      };
    });

    return result;
  } catch (error) {
    console.error('Place hold error:', error);
    throw error;
  }
}

/**
 * Release a hold (project failed or pledge cancelled)
 */
export async function releaseHold(pledgeId: string): Promise<CaptureResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find the hold
      const hold = await tx.creditHold.findUnique({
        where: { pledgeId },
        include: { creditBalance: true },
      });

      if (!hold) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_FOUND,
          message: 'Hold not found for this pledge.',
        };
      }

      if (hold.status !== HoldStatus.ACTIVE) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_ACTIVE,
          message: `Hold is not active. Current status: ${hold.status}`,
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

      // Create ledger entry
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_RELEASED',
          amount: amount, // Positive because credits returned
          balanceAfter: creditBalance.availableBalance,
          holdId: hold.id,
          description: `Hold released for pledge ${pledgeId}`,
        },
      });

      return {
        success: true,
        amount,
      };
    });

    return result;
  } catch (error) {
    console.error('Release hold error:', error);
    throw error;
  }
}

/**
 * Capture a hold (project funded successfully)
 */
export async function captureHold(pledgeId: string): Promise<CaptureResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find the hold
      const hold = await tx.creditHold.findUnique({
        where: { pledgeId },
        include: { creditBalance: true },
      });

      if (!hold) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_FOUND,
          message: 'Hold not found for this pledge.',
        };
      }

      if (hold.status !== HoldStatus.ACTIVE) {
        return {
          success: false,
          error: HoldErrors.HOLD_NOT_ACTIVE,
          message: `Hold is not active. Current status: ${hold.status}`,
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

      // Create ledger entry
      await tx.creditLedger.create({
        data: {
          creditBalanceId: creditBalance.id,
          type: 'HOLD_CAPTURED',
          amount: -amount, // Negative because credits are gone
          balanceAfter: creditBalance.availableBalance,
          holdId: hold.id,
          description: `Hold captured for pledge ${pledgeId}`,
        },
      });

      return {
        success: true,
        amount,
      };
    });

    return result;
  } catch (error) {
    console.error('Capture hold error:', error);
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
