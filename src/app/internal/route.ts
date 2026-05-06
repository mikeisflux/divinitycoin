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
import { getStripeClient } from '@/lib/stripe';
import { getStripeConfig } from '@/lib/config';
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

      case 'create-payment-intent':
        return handleCreatePaymentIntent(body, partnerId!);

      case 'refund':
        return handleRefund(body, partnerId!, ipAddress);

      case 'verify-payment':
        return handleVerifyPayment(body, partnerId!);

      case 'create-setup-intent':
        return handleCreateSetupIntent(body, partnerId!);

      case 'list-payment-methods':
        return handleListPaymentMethods(body, partnerId!);

      case 'detach-payment-method':
        return handleDetachPaymentMethod(body, partnerId!);

      case 'charge-saved-payment-method':
        return handleChargeSavedPaymentMethod(body, partnerId!);

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

/**
 * Create a Stripe PaymentIntent for seamless payment
 * Returns client_secret for Stripe Elements and publishable key
 * Supports type: "upcharge" for pledge modification additional charges
 */
async function handleCreatePaymentIntent(
  body: {
    amount: number;
    currency?: string;
    platformUserId: string;
    email: string;
    name?: string;
    pledgeId: string;
    projectId: string;
    statement_descriptor?: string;
    type?: string;
    originalPaymentId?: string;
  },
  partnerId: string
) {
  const {
    amount, currency = 'usd', platformUserId, email, pledgeId, projectId,
    statement_descriptor, type, originalPaymentId,
  } = body;

  // Validate required fields
  if (!amount || !platformUserId || !email || !pledgeId || !projectId) {
    return NextResponse.json(
      { error: 'Missing required fields: amount, platformUserId, email, pledgeId, projectId' },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      { error: 'Amount must be positive' },
      { status: 400 }
    );
  }

  const isUpcharge = type === 'upcharge';

  try {
    const stripe = await getStripeClient();
    const stripeConfig = await getStripeConfig();

    // Find or create DC user for this platformUserId.
    // Use upsert so two concurrent requests can't both pass a "not found"
    // check and both try to create the same platformUserId.
    let dcUser = await prisma.platformUser.upsert({
      where: { platformUserId },
      create: {
        platformUserId,
        email,
        partnerId,
      },
      update: {},
    });

    // Find or create Stripe customer.
    // Use idempotencyKey so concurrent requests for a user without a
    // customer don't create two orphan Stripe customers.
    let stripeCustomerId = dcUser.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email,
          metadata: {
            platformUserId,
            partnerId,
          },
        },
        { idempotencyKey: `customer-${platformUserId}` },
      );
      stripeCustomerId = customer.id;

      // Only write the id if it's still missing (avoid clobbering a
      // customer id a concurrent request may have just written).
      await prisma.platformUser.updateMany({
        where: { id: dcUser.id, stripeCustomerId: null },
        data: { stripeCustomerId },
      });

      // Re-read to pick up whichever customer id won the race.
      const refreshed = await prisma.platformUser.findUnique({
        where: { id: dcUser.id },
        select: { stripeCustomerId: true },
      });
      if (refreshed?.stripeCustomerId) stripeCustomerId = refreshed.stripeCustomerId;
    }

    // Build metadata for webhook processing
    const intentMetadata: Record<string, string> = {
      type: isUpcharge ? 'partner_upcharge' : 'partner_payment',
      partnerId,
      platformUserId,
      pledgeId,
      projectId,
      email,
    };

    if (isUpcharge && originalPaymentId) {
      intentMetadata.originalPaymentId = originalPaymentId;
    }

    // Create Stripe PaymentIntent with metadata for webhook processing
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: stripeCustomerId,
      metadata: intentMetadata,
      statement_descriptor_suffix: statement_descriptor?.substring(0, 22), // Max 22 chars; suffix required for card payments
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Store pending payment mapping
    await prisma.pendingPartnerPayment.create({
      data: {
        paymentIntentId: paymentIntent.id,
        partnerId,
        platformUserId,
        pledgeId,
        projectId,
        amount,
        currency,
        email,
        status: 'PENDING',
      },
    });

    logger.info('Partner payment intent created', {
      paymentIntentId: paymentIntent.id,
      partnerId,
      platformUserId,
      amount,
      pledgeId,
      type: isUpcharge ? 'upcharge' : 'initial',
    });

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: stripeConfig.publishableKey,
      amount,
    });
  } catch (error) {
    logger.error('Failed to create payment intent', { error, partnerId, platformUserId, amount });
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Process a refund for a partner payment
 * Supports full refunds (cancellations) and partial refunds (pledge modifications)
 * Full: Stripe refund + void gift card + release hold + deduct balance + webhook
 * Partial: Stripe refund + deduct balance only (hold/gift card stay active, no webhook or partial webhook)
 */
async function handleRefund(
  body: {
    paymentIntentId?: string;
    paymentId?: string;
    amount?: number;
    reason?: string;
    pledgeId?: string;
    partial?: boolean;
    requestedBy?: string;
  },
  partnerId: string,
  ipAddress: string
) {
  // Support both paymentIntentId and paymentId (alias)
  const paymentIntentId = body.paymentIntentId || body.paymentId;
  const { amount, reason, pledgeId, partial = false } = body;

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: 'paymentIntentId or paymentId is required' },
      { status: 400 }
    );
  }

  try {
    const stripe = await getStripeClient();

    // Find the pending/completed payment record
    const paymentRecord = await prisma.pendingPartnerPayment.findUnique({
      where: { paymentIntentId },
    });

    if (!paymentRecord) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify the partner owns this payment
    if (paymentRecord.partnerId !== partnerId && partnerId !== 'internal') {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Get the original payment intent to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Cannot refund payment with status: ${paymentIntent.status}` },
        { status: 400 }
      );
    }

    // Process Stripe refund (partial or full).
    // Idempotency key: for full refunds, a deterministic key per payment
    // ensures duplicate calls return the same refund instead of issuing a
    // second one. For partial refunds, include the amount so distinct
    // partials succeed but accidental duplicates are coalesced.
    const refundAmount = amount || paymentRecord.amount;
    const refundIdempotencyKey = partial
      ? `refund-partial-${paymentIntentId}-${refundAmount}`
      : `refund-full-${paymentIntentId}`;
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          partnerId,
          pledgeId: pledgeId || paymentRecord.pledgeId,
          reason: reason || 'partner_refund',
          partial: partial ? 'true' : 'false',
        },
      },
      { idempotencyKey: refundIdempotencyKey },
    );

    // For full refunds: void gift card and release hold
    if (!partial) {
      // Void the associated gift card
      if (paymentRecord.giftCardId) {
        await prisma.giftCard.update({
          where: { id: paymentRecord.giftCardId },
          data: { status: 'REVOKED' },
        });
      }

      // Release the hold
      const holdPledgeId = pledgeId || paymentRecord.pledgeId;
      if (holdPledgeId) {
        try {
          await releaseHold(holdPledgeId, ipAddress);
        } catch {
          // Hold may not exist or already released - that's ok
        }
      }
    }

    // Deduct from user's credit balance for both partial and full refunds
    if (paymentRecord.status === 'COMPLETED') {
      const creditBalance = await prisma.creditBalance.findUnique({
        where: { platformUserId: paymentRecord.platformUserId },
      });

      if (creditBalance) {
        const refundAmountDollars = refundAmount / 100;
        const currentAvailable = Number(creditBalance.availableBalance);

        // For partial refunds, deduct from available balance
        // For full refunds, deduct from available balance
        if (currentAvailable >= refundAmountDollars) {
          await prisma.creditBalance.update({
            where: { id: creditBalance.id },
            data: {
              availableBalance: { decrement: refundAmountDollars },
            },
          });

          // Create ledger entry
          await prisma.creditLedger.create({
            data: {
              creditBalanceId: creditBalance.id,
              type: 'REFUND',
              amount: -refundAmountDollars,
              balanceAfter: currentAvailable - refundAmountDollars,
              description: partial
                ? `Partial refund for payment ${paymentIntentId}`
                : `Refund for payment ${paymentIntentId}`,
              metadata: {
                paymentIntentId,
                refundId: refund.id,
                reason,
                partial,
                ipAddress,
              },
            },
          });
        }
      }
    }

    // Update payment record status
    // For partial refunds, keep the payment as COMPLETED (pledge stays active)
    if (!partial) {
      await prisma.pendingPartnerPayment.update({
        where: { paymentIntentId },
        data: {
          status: 'REFUNDED',
          refundId: refund.id,
          refundedAt: new Date(),
        },
      });
    }

    // Send webhook to partner - skip for partial refunds, or include partial flag
    if (!partial) {
      const partner = await prisma.partner.findUnique({
        where: { id: paymentRecord.partnerId },
        select: { webhookUrl: true, webhookSecret: true },
      });

      if (partner?.webhookUrl && partner?.webhookSecret) {
        const { sendWebhook } = await import('@/lib/partner/webhook');
        await sendWebhook(partner.webhookUrl, partner.webhookSecret, 'refund.completed', {
          paymentIntentId,
          refundId: refund.id,
          amount: refundAmount,
          pledgeId: pledgeId || paymentRecord.pledgeId,
          platformUserId: paymentRecord.platformUserId,
          status: 'succeeded',
          partial: false,
        });
      }
    }

    logger.info('Partner refund processed', {
      paymentIntentId,
      refundId: refund.id,
      amount: refundAmount,
      partial,
      partnerId,
    });

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refundAmount,
      partial,
      status: 'succeeded',
    });
  } catch (error) {
    logger.error('Failed to process refund', { error, paymentIntentId, partnerId });
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}

/**
 * Create a Stripe SetupIntent so a partner can save a card on file.
 * Card is attached to the DC Stripe Customer for this platformUserId,
 * then later charged off-session via charge-saved-payment-method.
 */
async function handleCreateSetupIntent(
  body: {
    platformUserId: string;
    email: string;
    name?: string;
  },
  partnerId: string,
) {
  const { platformUserId, email } = body;

  if (!platformUserId || !email) {
    return NextResponse.json(
      { error: 'Missing required fields: platformUserId, email' },
      { status: 400 },
    );
  }

  try {
    const stripe = await getStripeClient();
    const stripeConfig = await getStripeConfig();

    // Find or create DC user. Same upsert pattern as create-payment-intent
    // so a fresh user can save a card without a prior pledge.
    const dcUser = await prisma.platformUser.upsert({
      where: { platformUserId },
      create: { platformUserId, email, partnerId },
      update: {},
    });

    // Find or create Stripe customer (same idempotency dance as create-payment-intent).
    let stripeCustomerId = dcUser.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email,
          metadata: { platformUserId, partnerId },
        },
        { idempotencyKey: `customer-${platformUserId}` },
      );
      stripeCustomerId = customer.id;

      await prisma.platformUser.updateMany({
        where: { id: dcUser.id, stripeCustomerId: null },
        data: { stripeCustomerId },
      });

      const refreshed = await prisma.platformUser.findUnique({
        where: { id: dcUser.id },
        select: { stripeCustomerId: true },
      });
      if (refreshed?.stripeCustomerId) stripeCustomerId = refreshed.stripeCustomerId;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { partnerId, platformUserId, email },
    });

    logger.info('Setup intent created', {
      setupIntentId: setupIntent.id,
      partnerId,
      platformUserId,
    });

    return NextResponse.json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      publishableKey: stripeConfig.publishableKey,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    logger.error('Failed to create setup intent', { error, partnerId, platformUserId });
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 },
    );
  }
}

/**
 * List saved cards for a partner's user. Returns Stripe payment_method IDs
 * plus enough metadata to render a "manage cards" UI.
 */
async function handleListPaymentMethods(
  body: { platformUserId: string },
  partnerId: string,
) {
  const { platformUserId } = body;

  if (!platformUserId) {
    return NextResponse.json(
      { error: 'platformUserId is required' },
      { status: 400 },
    );
  }

  try {
    const dcUser = await prisma.platformUser.findUnique({
      where: { platformUserId },
    });

    if (!dcUser || (dcUser.partnerId !== partnerId && partnerId !== 'internal')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!dcUser.stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const stripe = await getStripeClient();
    const list = await stripe.paymentMethods.list({
      customer: dcUser.stripeCustomerId,
      type: 'card',
    });

    return NextResponse.json({
      paymentMethods: list.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        funding: pm.card?.funding,
        country: pm.card?.country,
        createdAt: new Date(pm.created * 1000).toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Failed to list payment methods', { error, partnerId, platformUserId });
    return NextResponse.json(
      { error: 'Failed to list payment methods' },
      { status: 500 },
    );
  }
}

/**
 * Detach a saved payment method from a partner's user. Verifies the card
 * actually belongs to that user before detaching to prevent cross-tenant leaks.
 */
async function handleDetachPaymentMethod(
  body: { platformUserId: string; paymentMethodId: string },
  partnerId: string,
) {
  const { platformUserId, paymentMethodId } = body;

  if (!platformUserId || !paymentMethodId) {
    return NextResponse.json(
      { error: 'Missing required fields: platformUserId, paymentMethodId' },
      { status: 400 },
    );
  }

  try {
    const dcUser = await prisma.platformUser.findUnique({
      where: { platformUserId },
    });

    if (!dcUser || (dcUser.partnerId !== partnerId && partnerId !== 'internal')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = await getStripeClient();
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (pm.customer !== dcUser.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 },
      );
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    logger.info('Payment method detached', {
      paymentMethodId,
      partnerId,
      platformUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to detach payment method', { error, partnerId, platformUserId });
    return NextResponse.json(
      { error: 'Failed to detach payment method' },
      { status: 500 },
    );
  }
}

/**
 * Charge a previously-saved card off-session. Used by partners to bill
 * users for things like won auctions without requiring a re-prompt.
 *
 * If the card declines or 3DS is required, surfaces enough info for the
 * partner to bring the user back on-session and re-confirm via Stripe Elements.
 */
async function handleChargeSavedPaymentMethod(
  body: {
    platformUserId: string;
    paymentMethodId: string;
    amount: number;
    currency?: string;
    pledgeId: string;
    projectId: string;
    statement_descriptor?: string;
    description?: string;
  },
  partnerId: string,
) {
  const {
    platformUserId,
    paymentMethodId,
    amount,
    currency = 'usd',
    pledgeId,
    projectId,
    statement_descriptor,
    description,
  } = body;

  if (!platformUserId || !paymentMethodId || !amount || !pledgeId || !projectId) {
    return NextResponse.json(
      { error: 'Missing required fields: platformUserId, paymentMethodId, amount, pledgeId, projectId' },
      { status: 400 },
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      { error: 'Amount must be positive' },
      { status: 400 },
    );
  }

  try {
    const dcUser = await prisma.platformUser.findUnique({
      where: { platformUserId },
    });

    if (!dcUser || (dcUser.partnerId !== partnerId && partnerId !== 'internal')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!dcUser.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No saved customer for this user' },
        { status: 400 },
      );
    }

    const stripe = await getStripeClient();

    // Verify ownership of the payment method before charging.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== dcUser.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 },
      );
    }

    const intentMetadata: Record<string, string> = {
      type: 'partner_payment',
      partnerId,
      platformUserId,
      pledgeId,
      projectId,
      email: dcUser.email,
      offSession: 'true',
    };

    // Idempotency: pledgeId is the natural unique key per charge attempt.
    // A retry from the partner returns the same PI instead of double-charging.
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: dcUser.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description,
        metadata: intentMetadata,
        statement_descriptor_suffix: statement_descriptor?.substring(0, 22),
      },
      { idempotencyKey: `charge-saved-${pledgeId}` },
    );

    await prisma.pendingPartnerPayment.create({
      data: {
        paymentIntentId: paymentIntent.id,
        partnerId,
        platformUserId,
        pledgeId,
        projectId,
        amount,
        currency,
        email: dcUser.email,
        status: paymentIntent.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
      },
    });

    logger.info('Saved payment method charged', {
      paymentIntentId: paymentIntent.id,
      partnerId,
      platformUserId,
      amount,
      status: paymentIntent.status,
    });

    return NextResponse.json({
      success: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      amount,
    });
  } catch (error) {
    // Stripe surfaces declines and 3DS-required cases as exceptions on confirm.
    // Pass enough back to the partner to either give up or re-prompt the user.
    const stripeErr = error as {
      code?: string;
      decline_code?: string;
      message?: string;
      payment_intent?: { id?: string; client_secret?: string; status?: string };
    };

    if (stripeErr?.code) {
      logger.warn('Saved payment method charge failed', {
        code: stripeErr.code,
        declineCode: stripeErr.decline_code,
        partnerId,
        platformUserId,
        paymentIntentId: stripeErr.payment_intent?.id,
      });

      return NextResponse.json(
        {
          success: false,
          status: stripeErr.payment_intent?.status ?? 'failed',
          error: stripeErr.message ?? 'Charge failed',
          code: stripeErr.code,
          declineCode: stripeErr.decline_code,
          paymentIntentId: stripeErr.payment_intent?.id,
          clientSecret: stripeErr.payment_intent?.client_secret,
        },
        { status: 402 },
      );
    }

    logger.error('Failed to charge saved payment method', { error, partnerId, platformUserId });
    return NextResponse.json(
      { error: 'Failed to charge payment method' },
      { status: 500 },
    );
  }
}

/**
 * Verify payment status server-side
 * Lets partners confirm a payment succeeded after frontend reports success
 */
async function handleVerifyPayment(
  body: { paymentIntentId?: string; paymentId?: string },
  partnerId: string
) {
  const paymentIntentId = body.paymentIntentId || body.paymentId;

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: 'paymentIntentId is required' },
      { status: 400 }
    );
  }

  try {
    // Look up our payment record first
    const paymentRecord = await prisma.pendingPartnerPayment.findUnique({
      where: { paymentIntentId },
    });

    if (!paymentRecord) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify the partner owns this payment
    if (paymentRecord.partnerId !== partnerId && partnerId !== 'internal') {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify against Stripe
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Map Stripe status to simpler statuses
    let status: string;
    switch (paymentIntent.status) {
      case 'succeeded':
        status = 'succeeded';
        break;
      case 'processing':
        status = 'pending';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        status = 'pending';
        break;
      case 'canceled':
        status = 'failed';
        break;
      default:
        status = paymentIntent.status;
    }

    return NextResponse.json({
      success: true,
      status,
      amount: paymentIntent.amount,
      pledgeId: paymentRecord.pledgeId,
      projectId: paymentRecord.projectId,
      platformUserId: paymentRecord.platformUserId,
      holdId: paymentRecord.holdId,
      dcStatus: paymentRecord.status,
    });
  } catch (error) {
    logger.error('Failed to verify payment', { error, paymentIntentId, partnerId });
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
