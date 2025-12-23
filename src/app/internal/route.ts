// app/internal/route.ts
// Internal API endpoints for partner integrations

import { NextRequest, NextResponse } from 'next/server';
import { validateAndRedeemCode, checkCodeStatus } from '@/lib/giftcard/redeem';
import { placeHold, releaseHold, captureHold, getBalance } from '@/lib/credits/holds';
import { redemptionRateLimiter, payRateLimiter, createRateLimitKey } from '@/lib/rateLimit';
import { getSettlements, getSettlementDetail, getCaptures, createCapture } from '@/lib/settlements';
import { SettlementStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashApiKey } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Fallback to legacy INTERNAL_API_KEY for backwards compatibility
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

interface AuthResult {
  valid: boolean;
  partnerId?: string;
  partnerName?: string;
  error?: string;
}

/**
 * Validate internal API request using partner API keys from database
 */
async function validateInternalRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.slice(7);

  // Check legacy internal API key first (for backwards compatibility)
  // SECURITY: Use timing-safe comparison to prevent timing attacks
  if (INTERNAL_API_KEY && token.length === INTERNAL_API_KEY.length) {
    try {
      const isMatch = crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(INTERNAL_API_KEY)
      );
      if (isMatch) {
        return { valid: true, partnerId: 'internal', partnerName: 'Internal System' };
      }
    } catch {
      // Length mismatch or other error - continue to database lookup
    }
  }

  // Hash the provided API key and look it up in the database
  const keyHash = hashApiKey(token);

  const apiKey = await prisma.partnerApiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!apiKey) {
    return { valid: false, error: 'Invalid or expired API key' };
  }

  if (apiKey.partner.status !== 'ACTIVE') {
    return { valid: false, error: 'Partner account is not active' };
  }

  // Update last used timestamp
  await prisma.partnerApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    partnerId: apiKey.partner.id,
    partnerName: apiKey.partner.name,
  };
}

/**
 * Get client IP address
 */
function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         '127.0.0.1';
}

export async function POST(request: NextRequest) {
  // Validate API key
  const auth = await validateInternalRequest(request);
  if (!auth.valid) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const body = await request.json();
    const ipAddress = getClientIp(request);
    const partnerId = auth.partnerId;

    switch (action) {
      case 'validate':
        return handleValidate(body, ipAddress, request);

      case 'balance':
        return handleBalance(body);

      case 'hold':
        return handleHold(body, ipAddress);

      case 'release':
        return handleRelease(body, ipAddress);

      case 'capture':
        return handleCapture(body, ipAddress);

      case 'record_capture':
        return handleRecordCapture(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    // SECURITY: Use sanitized logger to prevent sensitive data exposure
    logger.apiError('/internal', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Record capture metadata for settlement
 */
async function handleRecordCapture(body: {
  holdId: string;
  partnerId: string;
  creatorId: string;
  creatorEmail?: string;
  projectId: string;
  projectName?: string;
  amount: number;
}) {
  const { holdId, partnerId, creatorId, projectId, amount } = body;

  if (!holdId || !partnerId || !creatorId || !projectId || !amount) {
    return NextResponse.json(
      { error: 'Missing required fields: holdId, partnerId, creatorId, projectId, amount' },
      { status: 400 }
    );
  }

  try {
    const result = await createCapture({
      holdId,
      partnerId,
      creatorId,
      creatorEmail: body.creatorEmail,
      projectId,
      projectName: body.projectName,
      amount,
    });

    return NextResponse.json({
      success: true,
      capture: {
        id: result.id,
        holdId,
        amount,
        capturedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to record capture', { error, holdId });
    return NextResponse.json(
      { error: 'Failed to record capture' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Validate API key
  const auth = await validateInternalRequest(request);
  if (!auth.valid) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  // Use authenticated partner's ID, or allow explicit partnerId for internal system
  const partnerId: string | null = auth.partnerId === 'internal'
    ? url.searchParams.get('partnerId')
    : (auth.partnerId ?? null);

  switch (action) {
    case 'health':
      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });

    case 'settlements':
      return handleGetSettlements(url, partnerId);

    case 'settlement':
      return handleGetSettlement(url, partnerId);

    case 'captures':
      return handleGetCaptures(url, partnerId);

    default:
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
  }
}

/**
 * Get list of settlements for a partner
 */
async function handleGetSettlements(url: URL, partnerId: string | null) {
  if (!partnerId) {
    return NextResponse.json(
      { error: 'partnerId is required' },
      { status: 400 }
    );
  }

  const status = url.searchParams.get('status') as SettlementStatus | null;
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;

  const result = await getSettlements({
    partnerId,
    status: status || undefined,
    from,
    to,
    limit,
    offset,
  });

  return NextResponse.json({
    settlements: result.settlements.map(s => ({
      id: s.id,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      grossAmount: s.grossAmount,
      partnerFee: s.partnerFee,
      netAmount: s.netAmount,
      captureCount: s.captureCount,
      status: s.status,
      paymentMethod: s.paymentMethod,
      paymentRef: s.paymentRef,
      paidAt: s.paidAt?.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
    pagination: {
      total: result.total,
      limit,
      offset,
    },
  });
}

/**
 * Get settlement detail by ID
 */
async function handleGetSettlement(url: URL, partnerId: string | null) {
  if (!partnerId) {
    return NextResponse.json(
      { error: 'partnerId is required' },
      { status: 400 }
    );
  }

  const settlementId = url.searchParams.get('id');
  if (!settlementId) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    );
  }

  const settlement = await getSettlementDetail(settlementId);

  if (!settlement) {
    return NextResponse.json(
      { error: 'Settlement not found' },
      { status: 404 }
    );
  }

  // Verify the settlement belongs to the requesting partner
  if (settlement.partnerId !== partnerId) {
    return NextResponse.json(
      { error: 'Settlement not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    settlement: {
      id: settlement.id,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      grossAmount: settlement.grossAmount,
      partnerFee: settlement.partnerFee,
      feePercentage: settlement.feePercentage,
      netAmount: settlement.netAmount,
      currency: settlement.currency,
      status: settlement.status,
      paymentMethod: settlement.paymentMethod,
      paymentRef: settlement.paymentRef,
      paidAt: settlement.paidAt?.toISOString(),
    },
    captures: settlement.captures.map(c => ({
      id: c.id,
      creatorId: c.creatorId,
      creatorEmail: c.creatorEmail,
      projectId: c.projectId,
      projectName: c.projectName,
      amount: c.amount,
      capturedAt: c.capturedAt.toISOString(),
    })),
    summary: {
      byCreator: settlement.byCreator,
      byProject: settlement.byProject,
    },
  });
}

/**
 * Get captures for a partner
 */
async function handleGetCaptures(url: URL, partnerId: string | null) {
  if (!partnerId) {
    return NextResponse.json(
      { error: 'partnerId is required' },
      { status: 400 }
    );
  }

  const settled = url.searchParams.get('settled');
  const creatorId = url.searchParams.get('creatorId') || undefined;
  const projectId = url.searchParams.get('projectId') || undefined;
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;

  let settledFilter: boolean | undefined;
  if (settled === 'true') settledFilter = true;
  else if (settled === 'false') settledFilter = false;

  const result = await getCaptures({
    partnerId,
    settled: settledFilter,
    creatorId,
    projectId,
    from,
    to,
    limit,
    offset,
  });

  return NextResponse.json({
    captures: result.captures.map(c => ({
      id: c.id,
      holdId: c.holdId,
      creatorId: c.creatorId,
      creatorEmail: c.creatorEmail,
      projectId: c.projectId,
      projectName: c.projectName,
      amount: c.amount,
      capturedAt: c.capturedAt.toISOString(),
    })),
    summary: {
      totalUnsettled: result.summary.totalUnsettled,
      captureCount: result.summary.captureCount,
    },
    pagination: {
      total: result.total,
      limit,
      offset,
    },
  });
}

/**
 * Validate and redeem a gift card code
 * SECURITY: Includes rate limiting and lockout after failed attempts
 */
async function handleValidate(
  body: { code: string; platformUserId: string },
  ipAddress: string,
  request: NextRequest
) {
  const { code, platformUserId } = body;

  if (!code || !platformUserId) {
    return NextResponse.json(
      { success: false, error: 'MISSING_PARAMS', message: 'code and platformUserId are required' },
      { status: 400 }
    );
  }

  // Check rate limit and lockout status
  const rateLimitKey = createRateLimitKey('redeem', ipAddress, platformUserId);
  const rateLimit = redemptionRateLimiter.check(rateLimitKey);

  // SECURITY: Check if locked out due to too many failed attempts
  if (rateLimit.lockedOut) {
    return NextResponse.json(
      {
        success: false,
        error: 'LOCKED_OUT',
        message: `Account temporarily locked due to too many failed attempts. Try again in ${rateLimit.lockoutRemaining} seconds.`,
        retryAfter: rateLimit.lockoutRemaining,
      },
      { status: 429 }
    );
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'RATE_LIMITED',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter,
      },
      { status: 429 }
    );
  }

  // Validate and redeem
  const result = await validateAndRedeemCode({
    code,
    platformUserId,
    ipAddress,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  // SECURITY: Track success/failure for lockout mechanism
  if (!result.success) {
    const lockoutResult = redemptionRateLimiter.recordFailure(rateLimitKey);

    // Add lockout info to response if triggered
    if (lockoutResult.lockedOut) {
      return NextResponse.json(
        {
          ...result,
          lockedOut: true,
          lockoutRemaining: lockoutResult.lockoutRemaining,
          message: `${result.message} Account locked for ${lockoutResult.lockoutRemaining} seconds due to repeated failed attempts.`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(result, { status: 400 });
  }

  // Reset lockout tracking on successful redemption
  redemptionRateLimiter.recordSuccess(rateLimitKey);

  return NextResponse.json(result);
}

/**
 * Get user's credit balance
 */
async function handleBalance(body: { platformUserId: string }) {
  const { platformUserId } = body;

  if (!platformUserId) {
    return NextResponse.json(
      { error: 'platformUserId is required' },
      { status: 400 }
    );
  }

  const balance = await getBalance(platformUserId);

  if (!balance) {
    return NextResponse.json({
      available: 0,
      held: 0,
      total: 0,
      holds: [],
    });
  }

  return NextResponse.json(balance);
}

/**
 * Place a hold on credits
 * SECURITY: Rate limited to 10 requests/minute
 */
async function handleHold(
  body: {
    platformUserId: string;
    amount: number;
    pledgeId: string;
    projectId: string;
    expiresAt?: string;
  },
  ipAddress: string
) {
  const { platformUserId, amount, pledgeId, projectId, expiresAt } = body;

  if (!platformUserId || !amount || !pledgeId || !projectId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // SECURITY: Rate limit pay/hold endpoint
  const rateLimitKey = createRateLimitKey('hold', ipAddress, platformUserId);
  const rateLimit = payRateLimiter.check(rateLimitKey);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'RATE_LIMITED',
        message: `Too many requests. Try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter,
      },
      { status: 429 }
    );
  }

  const result = await placeHold({
    platformUserId,
    amount,
    pledgeId,
    projectId,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    ipAddress,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

/**
 * Release a hold
 * Includes IP address in audit trail
 */
async function handleRelease(body: { pledgeId: string }, ipAddress: string) {
  const { pledgeId } = body;

  if (!pledgeId) {
    return NextResponse.json(
      { error: 'pledgeId is required' },
      { status: 400 }
    );
  }

  const result = await releaseHold(pledgeId, ipAddress);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

/**
 * Capture a hold
 * Includes IP address in audit trail
 */
async function handleCapture(body: { pledgeId: string }, ipAddress: string) {
  const { pledgeId } = body;

  if (!pledgeId) {
    return NextResponse.json(
      { error: 'pledgeId is required' },
      { status: 400 }
    );
  }

  const result = await captureHold(pledgeId, ipAddress);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
