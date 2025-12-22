// lib/settlements/webhooks.ts
// Settlement webhook event dispatcher

import { prisma } from '@/lib/db';
import { sendWebhook } from '@/lib/partner/webhook';
import { SettlementStatus } from '@prisma/client';

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

export const SettlementEvents = {
  CREATED: 'settlement.created',
  APPROVED: 'settlement.approved',
  PROCESSING: 'settlement.processing',
  PAID: 'settlement.paid',
  FAILED: 'settlement.failed',
  DISPUTED: 'settlement.disputed',
} as const;

export type SettlementEventType = typeof SettlementEvents[keyof typeof SettlementEvents];

// Map status to event type
const statusToEvent: Record<SettlementStatus, SettlementEventType> = {
  [SettlementStatus.PENDING]: SettlementEvents.CREATED,
  [SettlementStatus.APPROVED]: SettlementEvents.APPROVED,
  [SettlementStatus.PROCESSING]: SettlementEvents.PROCESSING,
  [SettlementStatus.PAID]: SettlementEvents.PAID,
  [SettlementStatus.FAILED]: SettlementEvents.FAILED,
  [SettlementStatus.DISPUTED]: SettlementEvents.DISPUTED,
};

// ============================================
// WEBHOOK PAYLOAD
// ============================================

interface SettlementWebhookPayload {
  settlementId: string;
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  partnerFee: number;
  feePercentage: number;
  netAmount: number;
  captureCount: number;
  currency: string;
  status: string;
  paymentRef?: string;
  paidAt?: string;
}

// ============================================
// WEBHOOK DISPATCH
// ============================================

/**
 * Send a settlement webhook to the partner
 */
export async function sendSettlementWebhook(
  settlementId: string,
  eventType: SettlementEventType
): Promise<{ success: boolean; error?: string }> {
  // Get settlement with partner details
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id: settlementId },
    include: {
      partner: {
        select: {
          id: true,
          webhookUrl: true,
          webhookSecret: true,
          webhookEvents: true,
        },
      },
      _count: { select: { captures: true } },
    },
  });

  if (!settlement) {
    return { success: false, error: 'Settlement not found' };
  }

  // Check if partner has webhook configured
  if (!settlement.partner.webhookUrl || !settlement.partner.webhookSecret) {
    return { success: true }; // No webhook configured, skip silently
  }

  // Check if partner is subscribed to this event
  const subscribedEvents = settlement.partner.webhookEvents || [];
  if (subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) {
    return { success: true }; // Not subscribed to this event
  }

  // Build payload
  const payload: SettlementWebhookPayload = {
    settlementId: settlement.id,
    partnerId: settlement.partnerId,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    grossAmount: Number(settlement.grossAmount),
    partnerFee: Number(settlement.partnerFee),
    feePercentage: Number(settlement.feePercentage),
    netAmount: Number(settlement.netAmount),
    captureCount: settlement._count.captures,
    currency: settlement.currency,
    status: settlement.status,
    paymentRef: settlement.paymentRef ?? undefined,
    paidAt: settlement.paidAt?.toISOString(),
  };

  // Send webhook
  const result = await sendWebhook(
    settlement.partner.webhookUrl,
    settlement.partner.webhookSecret,
    eventType,
    payload as Record<string, unknown>
  );

  // Log webhook attempt
  await logWebhookAttempt({
    partnerId: settlement.partnerId,
    settlementId: settlement.id,
    eventType,
    webhookUrl: settlement.partner.webhookUrl,
    success: result.success,
    statusCode: result.statusCode,
    responseBody: result.responseBody,
    error: result.error,
    durationMs: result.durationMs,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || `HTTP ${result.statusCode}`,
    };
  }

  return { success: true };
}

/**
 * Send webhook based on settlement status change
 */
export async function notifySettlementStatusChange(
  settlementId: string,
  newStatus: SettlementStatus
): Promise<void> {
  const eventType = statusToEvent[newStatus];
  if (eventType) {
    await sendSettlementWebhook(settlementId, eventType);
  }
}

// ============================================
// WEBHOOK LOGGING
// ============================================

interface WebhookLogEntry {
  partnerId: string;
  settlementId: string;
  eventType: string;
  webhookUrl: string;
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
}

async function logWebhookAttempt(entry: WebhookLogEntry): Promise<void> {
  try {
    await prisma.apiRequestLog.create({
      data: {
        partnerId: entry.partnerId,
        method: 'POST',
        endpoint: '/webhook',
        path: entry.webhookUrl,
        ipAddress: '0.0.0.0', // Outbound
        statusCode: entry.statusCode ?? (entry.success ? 200 : 0),
        responseTimeMs: entry.durationMs,
        requestBody: JSON.stringify({
          eventType: entry.eventType,
          settlementId: entry.settlementId,
        }),
        responseBody: entry.responseBody?.substring(0, 1000),
        errorMessage: entry.error,
      },
    });
  } catch (logError) {
    console.error('Failed to log webhook attempt:', logError);
  }
}

// ============================================
// BULK NOTIFICATIONS
// ============================================

/**
 * Send webhooks for multiple settlements (e.g., after batch generation)
 */
export async function notifySettlementsCreated(settlementIds: string[]): Promise<{
  sent: number;
  failed: number;
}> {
  let sent = 0;
  let failed = 0;

  for (const id of settlementIds) {
    const result = await sendSettlementWebhook(id, SettlementEvents.CREATED);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Retry failed webhooks for a settlement
 */
export async function retrySettlementWebhook(
  settlementId: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<boolean> {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id: settlementId },
    select: { status: true },
  });

  if (!settlement) {
    return false;
  }

  const eventType = statusToEvent[settlement.status];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendSettlementWebhook(settlementId, eventType);

    if (result.success) {
      return true;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  return false;
}
