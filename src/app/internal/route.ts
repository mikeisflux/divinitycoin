// app/internal/route.ts
// Internal API endpoints - accessible only via VPN

import { NextRequest, NextResponse } from 'next/server';
import { validateAndRedeemCode, checkCodeStatus } from '@/lib/giftcard/redeem';
import { placeHold, releaseHold, captureHold, getBalance } from '@/lib/credits/holds';
import { redemptionRateLimiter, createRateLimitKey } from '@/lib/rateLimit';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Validate internal API request
 */
function validateInternalRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === INTERNAL_API_KEY;
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
  if (!validateInternalRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const body = await request.json();
    const ipAddress = getClientIp(request);

    switch (action) {
      case 'validate':
        return handleValidate(body, ipAddress, request);

      case 'balance':
        return handleBalance(body);

      case 'hold':
        return handleHold(body);

      case 'release':
        return handleRelease(body);

      case 'capture':
        return handleCapture(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Internal API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Validate API key
  if (!validateInternalRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'health') {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  );
}

/**
 * Validate and redeem a gift card code
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

  // Check rate limit
  const rateLimitKey = createRateLimitKey('redeem', ipAddress, platformUserId);
  const rateLimit = redemptionRateLimiter.check(rateLimitKey);

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

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

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
 */
async function handleHold(body: {
  platformUserId: string;
  amount: number;
  pledgeId: string;
  projectId: string;
  expiresAt?: string;
}) {
  const { platformUserId, amount, pledgeId, projectId, expiresAt } = body;

  if (!platformUserId || !amount || !pledgeId || !projectId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  const result = await placeHold({
    platformUserId,
    amount,
    pledgeId,
    projectId,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

/**
 * Release a hold
 */
async function handleRelease(body: { pledgeId: string }) {
  const { pledgeId } = body;

  if (!pledgeId) {
    return NextResponse.json(
      { error: 'pledgeId is required' },
      { status: 400 }
    );
  }

  const result = await releaseHold(pledgeId);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

/**
 * Capture a hold
 */
async function handleCapture(body: { pledgeId: string }) {
  const { pledgeId } = body;

  if (!pledgeId) {
    return NextResponse.json(
      { error: 'pledgeId is required' },
      { status: 400 }
    );
  }

  const result = await captureHold(pledgeId);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
