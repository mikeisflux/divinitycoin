// lib/settlements/index.ts
// Settlement system for partner payouts

import { prisma } from '@/lib/db';
import { SettlementStatus, SettlementFrequency, Prisma } from '@prisma/client';
import { getConfig } from '@/lib/admin/config';

// ============================================
// TYPES
// ============================================

export interface SettlementCalculation {
  grossAmount: number;
  partnerFee: number;
  feePercentage: number;
  netAmount: number;
  captureCount: number;
  captureIds: string[];
  periodStart: Date;
  periodEnd: Date;
}

export interface CreateCaptureParams {
  holdId: string;
  partnerId: string;
  creatorId: string;
  creatorEmail?: string;
  projectId: string;
  projectName?: string;
  amount: number;
}

export interface SettlementSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  partnerFee: number;
  netAmount: number;
  captureCount: number;
  status: SettlementStatus;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: Date;
  createdAt: Date;
}

export interface SettlementDetail extends SettlementSummary {
  feePercentage: number;
  currency: string;
  approvedBy?: string;
  approvedAt?: Date;
  adminNotes?: string;
  disputeReason?: string;
  captures: CaptureDetail[];
  byCreator: CreatorSummary[];
  byProject: ProjectSummary[];
}

export interface CaptureDetail {
  id: string;
  holdId: string;
  creatorId: string;
  creatorEmail?: string;
  projectId: string;
  projectName?: string;
  amount: number;
  capturedAt: Date;
}

export interface CreatorSummary {
  creatorId: string;
  creatorEmail?: string;
  amount: number;
  count: number;
}

export interface ProjectSummary {
  projectId: string;
  projectName?: string;
  amount: number;
  count: number;
}

export interface SettlementListParams {
  partnerId?: string;
  status?: SettlementStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_PARTNER_FEE = 0.06; // 6%
export const DEFAULT_MINIMUM_SETTLEMENT = 100; // $100

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get the default partner fee percentage from config or use default
 */
export async function getDefaultPartnerFee(): Promise<number> {
  const configValue = await getConfig('DEFAULT_PARTNER_FEE');
  if (configValue) {
    const parsed = parseFloat(configValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return DEFAULT_PARTNER_FEE;
}

/**
 * Get the default minimum settlement amount from config or use default
 */
export async function getDefaultMinimumSettlement(): Promise<number> {
  const configValue = await getConfig('DEFAULT_MINIMUM_SETTLEMENT');
  if (configValue) {
    const parsed = parseFloat(configValue);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_MINIMUM_SETTLEMENT;
}

/**
 * Get the auto-approve threshold (settlements under this are auto-approved)
 */
export async function getAutoApproveThreshold(): Promise<number | null> {
  const enabled = await getConfig('AUTO_APPROVE_ENABLED');
  if (enabled !== 'true') {
    return null;
  }

  const threshold = await getConfig('AUTO_APPROVE_THRESHOLD');
  if (threshold) {
    const parsed = parseFloat(threshold);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

// ============================================
// CAPTURE FUNCTIONS
// ============================================

/**
 * Create a credit capture record (called when a hold is captured)
 */
export async function createCapture(params: CreateCaptureParams): Promise<{ id: string }> {
  const capture = await prisma.creditCapture.create({
    data: {
      holdId: params.holdId,
      partnerId: params.partnerId,
      creatorId: params.creatorId,
      creatorEmail: params.creatorEmail,
      projectId: params.projectId,
      projectName: params.projectName,
      amount: params.amount,
    },
  });

  return { id: capture.id };
}

/**
 * Get unsettled captures for a partner
 */
export async function getUnsettledCaptures(partnerId: string): Promise<CaptureDetail[]> {
  const captures = await prisma.creditCapture.findMany({
    where: {
      partnerId,
      settlementId: null,
    },
    orderBy: { capturedAt: 'asc' },
  });

  return captures.map(c => ({
    id: c.id,
    holdId: c.holdId,
    creatorId: c.creatorId,
    creatorEmail: c.creatorEmail ?? undefined,
    projectId: c.projectId,
    projectName: c.projectName ?? undefined,
    amount: Number(c.amount),
    capturedAt: c.capturedAt,
  }));
}

// ============================================
// SETTLEMENT CALCULATION
// ============================================

/**
 * Calculate settlement for a partner's unsettled captures
 */
export async function calculateSettlement(partnerId: string): Promise<SettlementCalculation | null> {
  // Get partner with fee override
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { partnerFeeOverride: true },
  });

  if (!partner) {
    return null;
  }

  // Get unsettled captures
  const captures = await prisma.creditCapture.findMany({
    where: {
      partnerId,
      settlementId: null,
    },
  });

  if (captures.length === 0) {
    return null;
  }

  // Calculate totals
  const grossAmount = captures.reduce((sum, c) => sum + Number(c.amount), 0);

  // Get fee percentage (partner override or default)
  const defaultFee = await getDefaultPartnerFee();
  const feePercentage = partner.partnerFeeOverride
    ? Number(partner.partnerFeeOverride)
    : defaultFee;

  const partnerFee = grossAmount * feePercentage;
  const netAmount = grossAmount - partnerFee;

  // Determine period based on capture dates
  const dates = captures.map(c => c.capturedAt.getTime());
  const periodStart = new Date(Math.min(...dates));
  const periodEnd = new Date(Math.max(...dates));

  return {
    grossAmount,
    partnerFee,
    feePercentage,
    netAmount,
    captureCount: captures.length,
    captureIds: captures.map(c => c.id),
    periodStart,
    periodEnd,
  };
}

// ============================================
// SETTLEMENT GENERATION
// ============================================

/**
 * Generate a settlement for a partner (if minimum threshold is met)
 */
export async function generateSettlement(partnerId: string): Promise<{ id: string } | null> {
  // Get partner with settings
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      minimumSettlement: true,
      partnerFeeOverride: true,
      paymentMethod: true,
    },
  });

  if (!partner) {
    throw new Error('Partner not found');
  }

  // Calculate settlement
  const calculation = await calculateSettlement(partnerId);

  if (!calculation) {
    return null; // No unsettled captures
  }

  // Check minimum threshold
  const defaultMinimum = await getDefaultMinimumSettlement();
  const minimumAmount = Number(partner.minimumSettlement) || defaultMinimum;

  if (calculation.grossAmount < minimumAmount) {
    return null; // Below minimum threshold
  }

  // Create settlement in transaction
  const settlement = await prisma.$transaction(async (tx) => {
    // Create settlement record
    const settlement = await tx.partnerSettlement.create({
      data: {
        partnerId,
        periodStart: calculation.periodStart,
        periodEnd: calculation.periodEnd,
        grossAmount: calculation.grossAmount,
        partnerFee: calculation.partnerFee,
        feePercentage: calculation.feePercentage,
        netAmount: calculation.netAmount,
        paymentMethod: partner.paymentMethod,
        status: SettlementStatus.PENDING,
      },
    });

    // Link captures to settlement
    await tx.creditCapture.updateMany({
      where: {
        id: { in: calculation.captureIds },
      },
      data: {
        settlementId: settlement.id,
        settledAt: new Date(),
      },
    });

    return settlement;
  });

  // Check for auto-approval
  const autoApproveThreshold = await getAutoApproveThreshold();
  if (autoApproveThreshold && calculation.netAmount <= autoApproveThreshold) {
    await approveSettlement(settlement.id, 'SYSTEM_AUTO_APPROVE');
  }

  return { id: settlement.id };
}

/**
 * Generate settlements for all eligible partners
 * Called by scheduled job
 */
export async function generateAllSettlements(): Promise<{ generated: number; partnersChecked: number }> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7; // 1-7 (Monday = 1)
  const dayOfMonth = now.getUTCDate();

  // Get all active partners
  const partners = await prisma.partner.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      settlementFrequency: true,
      settlementDay: true,
    },
  });

  let generated = 0;

  for (const partner of partners) {
    // Check if settlement is due based on frequency
    let isDue = false;

    switch (partner.settlementFrequency) {
      case SettlementFrequency.DAILY:
        isDue = true;
        break;
      case SettlementFrequency.WEEKLY:
        isDue = dayOfWeek === partner.settlementDay;
        break;
      case SettlementFrequency.BIWEEKLY:
        // Every other week on the specified day
        const weekNumber = Math.floor((now.getTime() - new Date(now.getUTCFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        isDue = dayOfWeek === partner.settlementDay && weekNumber % 2 === 0;
        break;
      case SettlementFrequency.MONTHLY:
        isDue = dayOfMonth === partner.settlementDay;
        break;
    }

    if (isDue) {
      try {
        const result = await generateSettlement(partner.id);
        if (result) {
          generated++;
        }
      } catch (error) {
        console.error(`Failed to generate settlement for partner ${partner.id}:`, error);
      }
    }
  }

  return { generated, partnersChecked: partners.length };
}

// ============================================
// SETTLEMENT STATUS MANAGEMENT
// ============================================

/**
 * Approve a settlement (PENDING -> APPROVED)
 */
export async function approveSettlement(settlementId: string, adminId: string): Promise<void> {
  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });
}

/**
 * Mark settlement as processing (APPROVED -> PROCESSING)
 */
export async function processSettlement(settlementId: string, paymentRef?: string): Promise<void> {
  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.PROCESSING,
      paymentRef,
    },
  });
}

/**
 * Mark settlement as paid (PROCESSING -> PAID)
 */
export async function markSettlementPaid(settlementId: string, paymentRef?: string): Promise<void> {
  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.PAID,
      paymentRef: paymentRef ?? undefined,
      paidAt: new Date(),
    },
  });
}

/**
 * Mark settlement as failed (PROCESSING -> FAILED)
 */
export async function markSettlementFailed(settlementId: string, reason?: string): Promise<void> {
  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.FAILED,
      adminNotes: reason,
    },
  });
}

/**
 * Dispute a settlement
 */
export async function disputeSettlement(settlementId: string, reason: string): Promise<void> {
  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.DISPUTED,
      disputeReason: reason,
    },
  });
}

/**
 * Add admin notes to a settlement
 */
export async function addSettlementNote(settlementId: string, note: string): Promise<void> {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id: settlementId },
    select: { adminNotes: true },
  });

  const timestamp = new Date().toISOString();
  const newNote = `[${timestamp}] ${note}`;
  const updatedNotes = settlement?.adminNotes
    ? `${settlement.adminNotes}\n${newNote}`
    : newNote;

  await prisma.partnerSettlement.update({
    where: { id: settlementId },
    data: { adminNotes: updatedNotes },
  });
}

// ============================================
// SETTLEMENT QUERIES
// ============================================

/**
 * Get list of settlements with filtering
 */
export async function getSettlements(params: SettlementListParams): Promise<{
  settlements: SettlementSummary[];
  total: number;
}> {
  const { partnerId, status, from, to, limit = 20, offset = 0 } = params;

  const where: Prisma.PartnerSettlementWhereInput = {};

  if (partnerId) {
    where.partnerId = partnerId;
  }

  if (status) {
    where.status = status;
  }

  if (from || to) {
    where.periodEnd = {};
    if (from) {
      where.periodEnd.gte = from;
    }
    if (to) {
      where.periodEnd.lte = to;
    }
  }

  const [settlements, total] = await Promise.all([
    prisma.partnerSettlement.findMany({
      where,
      include: {
        partner: { select: { name: true } },
        _count: { select: { captures: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.partnerSettlement.count({ where }),
  ]);

  return {
    settlements: settlements.map(s => ({
      id: s.id,
      partnerId: s.partnerId,
      partnerName: s.partner.name,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      grossAmount: Number(s.grossAmount),
      partnerFee: Number(s.partnerFee),
      netAmount: Number(s.netAmount),
      captureCount: s._count.captures,
      status: s.status,
      paymentMethod: s.paymentMethod ?? undefined,
      paymentRef: s.paymentRef ?? undefined,
      paidAt: s.paidAt ?? undefined,
      createdAt: s.createdAt,
    })),
    total,
  };
}

/**
 * Get detailed settlement by ID
 */
export async function getSettlementDetail(settlementId: string): Promise<SettlementDetail | null> {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id: settlementId },
    include: {
      partner: { select: { name: true } },
      captures: {
        orderBy: { capturedAt: 'asc' },
      },
    },
  });

  if (!settlement) {
    return null;
  }

  // Group by creator
  const byCreator = new Map<string, CreatorSummary>();
  for (const capture of settlement.captures) {
    const existing = byCreator.get(capture.creatorId);
    if (existing) {
      existing.amount += Number(capture.amount);
      existing.count += 1;
    } else {
      byCreator.set(capture.creatorId, {
        creatorId: capture.creatorId,
        creatorEmail: capture.creatorEmail ?? undefined,
        amount: Number(capture.amount),
        count: 1,
      });
    }
  }

  // Group by project
  const byProject = new Map<string, ProjectSummary>();
  for (const capture of settlement.captures) {
    const existing = byProject.get(capture.projectId);
    if (existing) {
      existing.amount += Number(capture.amount);
      existing.count += 1;
    } else {
      byProject.set(capture.projectId, {
        projectId: capture.projectId,
        projectName: capture.projectName ?? undefined,
        amount: Number(capture.amount),
        count: 1,
      });
    }
  }

  return {
    id: settlement.id,
    partnerId: settlement.partnerId,
    partnerName: settlement.partner.name,
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    grossAmount: Number(settlement.grossAmount),
    partnerFee: Number(settlement.partnerFee),
    feePercentage: Number(settlement.feePercentage),
    netAmount: Number(settlement.netAmount),
    captureCount: settlement.captures.length,
    status: settlement.status,
    currency: settlement.currency,
    paymentMethod: settlement.paymentMethod ?? undefined,
    paymentRef: settlement.paymentRef ?? undefined,
    paidAt: settlement.paidAt ?? undefined,
    approvedBy: settlement.approvedBy ?? undefined,
    approvedAt: settlement.approvedAt ?? undefined,
    adminNotes: settlement.adminNotes ?? undefined,
    disputeReason: settlement.disputeReason ?? undefined,
    createdAt: settlement.createdAt,
    captures: settlement.captures.map(c => ({
      id: c.id,
      holdId: c.holdId,
      creatorId: c.creatorId,
      creatorEmail: c.creatorEmail ?? undefined,
      projectId: c.projectId,
      projectName: c.projectName ?? undefined,
      amount: Number(c.amount),
      capturedAt: c.capturedAt,
    })),
    byCreator: Array.from(byCreator.values()).sort((a, b) => b.amount - a.amount),
    byProject: Array.from(byProject.values()).sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Get settlement statistics
 */
export async function getSettlementStats(partnerId?: string): Promise<{
  totalPending: number;
  pendingCount: number;
  totalPaidThisMonth: number;
  paidCountThisMonth: number;
  totalPaidThisYear: number;
  paidCountThisYear: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const startOfYear = new Date(now.getUTCFullYear(), 0, 1);

  const baseWhere: Prisma.PartnerSettlementWhereInput = partnerId
    ? { partnerId }
    : {};

  const [pending, paidThisMonth, paidThisYear] = await Promise.all([
    prisma.partnerSettlement.aggregate({
      where: { ...baseWhere, status: SettlementStatus.PENDING },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.partnerSettlement.aggregate({
      where: {
        ...baseWhere,
        status: SettlementStatus.PAID,
        paidAt: { gte: startOfMonth },
      },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.partnerSettlement.aggregate({
      where: {
        ...baseWhere,
        status: SettlementStatus.PAID,
        paidAt: { gte: startOfYear },
      },
      _sum: { netAmount: true },
      _count: true,
    }),
  ]);

  return {
    totalPending: Number(pending._sum.netAmount ?? 0),
    pendingCount: pending._count,
    totalPaidThisMonth: Number(paidThisMonth._sum.netAmount ?? 0),
    paidCountThisMonth: paidThisMonth._count,
    totalPaidThisYear: Number(paidThisYear._sum.netAmount ?? 0),
    paidCountThisYear: paidThisYear._count,
  };
}

/**
 * Get captures with filtering (for partner API)
 */
export async function getCaptures(params: {
  partnerId: string;
  settled?: boolean;
  creatorId?: string;
  projectId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  captures: CaptureDetail[];
  summary: { totalUnsettled: number; captureCount: number };
  total: number;
}> {
  const { partnerId, settled, creatorId, projectId, from, to, limit = 20, offset = 0 } = params;

  const where: Prisma.CreditCaptureWhereInput = { partnerId };

  if (typeof settled === 'boolean') {
    where.settlementId = settled ? { not: null } : null;
  }

  if (creatorId) {
    where.creatorId = creatorId;
  }

  if (projectId) {
    where.projectId = projectId;
  }

  if (from || to) {
    where.capturedAt = {};
    if (from) {
      where.capturedAt.gte = from;
    }
    if (to) {
      where.capturedAt.lte = to;
    }
  }

  const [captures, total, unsettledSum] = await Promise.all([
    prisma.creditCapture.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creditCapture.count({ where }),
    prisma.creditCapture.aggregate({
      where: { partnerId, settlementId: null },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    captures: captures.map(c => ({
      id: c.id,
      holdId: c.holdId,
      creatorId: c.creatorId,
      creatorEmail: c.creatorEmail ?? undefined,
      projectId: c.projectId,
      projectName: c.projectName ?? undefined,
      amount: Number(c.amount),
      capturedAt: c.capturedAt,
    })),
    summary: {
      totalUnsettled: Number(unsettledSum._sum.amount ?? 0),
      captureCount: unsettledSum._count,
    },
    total,
  };
}
