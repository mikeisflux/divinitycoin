// lib/settlements/index.ts
// Settlement system library - handles partner settlements and captures

import { prisma } from '@/lib/db';
import { SettlementStatus, Prisma } from '@prisma/client';

// ==============================================
// TYPES
// ==============================================

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
  paymentMethod: string | null;
  paymentRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface SettlementDetail extends SettlementSummary {
  feePercentage: number;
  currency: string;
  adminNotes: string | null;
  disputeReason: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  captures: CaptureInfo[];
  byCreator: { creatorId: string; creatorEmail?: string; amount: number; count: number }[];
  byProject: { projectId: string; projectName?: string; amount: number; count: number }[];
}

export interface CaptureInfo {
  id: string;
  holdId: string;
  creatorId: string;
  creatorEmail: string | null;
  projectId: string;
  projectName: string | null;
  amount: number;
  capturedAt: Date;
}

export interface SettlementStats {
  totalPending: number;
  pendingCount: number;
  totalPaidThisMonth: number;
  paidCountThisMonth: number;
  totalPaidThisYear: number;
  paidCountThisYear: number;
}

// ==============================================
// QUERY FUNCTIONS
// ==============================================

export interface GetSettlementsParams {
  partnerId?: string;
  status?: SettlementStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function getSettlements(params: GetSettlementsParams) {
  const { partnerId, status, from, to, limit = 20, offset = 0 } = params;

  const where: Prisma.PartnerSettlementWhereInput = {};

  if (partnerId) where.partnerId = partnerId;
  if (status) where.status = status;
  if (from || to) {
    where.periodEnd = {};
    if (from) where.periodEnd.gte = from;
    if (to) where.periodEnd.lte = to;
  }

  const [settlements, total] = await Promise.all([
    prisma.partnerSettlement.findMany({
      where,
      include: {
        partner: { select: { id: true, name: true } },
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
      paymentMethod: s.paymentMethod,
      paymentRef: s.paymentRef,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
    })),
    total,
  };
}

export async function getSettlementDetail(id: string): Promise<SettlementDetail | null> {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id },
    include: {
      partner: { select: { id: true, name: true } },
      captures: {
        orderBy: { capturedAt: 'desc' },
      },
    },
  });

  if (!settlement) return null;

  // Group captures by creator and project
  const byCreatorMap = new Map<string, { email?: string; amount: number; count: number }>();
  const byProjectMap = new Map<string, { name?: string; amount: number; count: number }>();

  for (const capture of settlement.captures) {
    // By creator
    const creatorData = byCreatorMap.get(capture.creatorId) || { email: capture.creatorEmail || undefined, amount: 0, count: 0 };
    creatorData.amount += Number(capture.amount);
    creatorData.count += 1;
    byCreatorMap.set(capture.creatorId, creatorData);

    // By project
    const projectData = byProjectMap.get(capture.projectId) || { name: capture.projectName || undefined, amount: 0, count: 0 };
    projectData.amount += Number(capture.amount);
    projectData.count += 1;
    byProjectMap.set(capture.projectId, projectData);
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
    currency: settlement.currency,
    captureCount: settlement.captures.length,
    status: settlement.status,
    paymentMethod: settlement.paymentMethod,
    paymentRef: settlement.paymentRef,
    paidAt: settlement.paidAt,
    adminNotes: settlement.adminNotes,
    disputeReason: settlement.disputeReason,
    approvedBy: settlement.approvedBy,
    approvedAt: settlement.approvedAt,
    createdAt: settlement.createdAt,
    captures: settlement.captures.map(c => ({
      id: c.id,
      holdId: c.holdId,
      creatorId: c.creatorId,
      creatorEmail: c.creatorEmail,
      projectId: c.projectId,
      projectName: c.projectName,
      amount: Number(c.amount),
      capturedAt: c.capturedAt,
    })),
    byCreator: Array.from(byCreatorMap.entries()).map(([creatorId, data]) => ({
      creatorId,
      creatorEmail: data.email,
      amount: data.amount,
      count: data.count,
    })),
    byProject: Array.from(byProjectMap.entries()).map(([projectId, data]) => ({
      projectId,
      projectName: data.name,
      amount: data.amount,
      count: data.count,
    })),
  };
}

export async function getSettlementStats(partnerId?: string): Promise<SettlementStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const baseWhere: Prisma.PartnerSettlementWhereInput = partnerId ? { partnerId } : {};

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
    totalPending: Number(pending._sum.netAmount) || 0,
    pendingCount: pending._count,
    totalPaidThisMonth: Number(paidThisMonth._sum.netAmount) || 0,
    paidCountThisMonth: paidThisMonth._count,
    totalPaidThisYear: Number(paidThisYear._sum.netAmount) || 0,
    paidCountThisYear: paidThisYear._count,
  };
}

// ==============================================
// CAPTURE FUNCTIONS
// ==============================================

export interface GetCapturesParams {
  partnerId: string;
  settled?: boolean;
  creatorId?: string;
  projectId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function getCaptures(params: GetCapturesParams) {
  const { partnerId, settled, creatorId, projectId, from, to, limit = 20, offset = 0 } = params;

  const where: Prisma.CreditCaptureWhereInput = { partnerId };

  if (settled === true) where.settlementId = { not: null };
  else if (settled === false) where.settlementId = null;

  if (creatorId) where.creatorId = creatorId;
  if (projectId) where.projectId = projectId;

  if (from || to) {
    where.capturedAt = {};
    if (from) where.capturedAt.gte = from;
    if (to) where.capturedAt.lte = to;
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
      creatorEmail: c.creatorEmail,
      projectId: c.projectId,
      projectName: c.projectName,
      amount: Number(c.amount),
      capturedAt: c.capturedAt,
    })),
    total,
    summary: {
      totalUnsettled: Number(unsettledSum._sum.amount) || 0,
      captureCount: unsettledSum._count,
    },
  };
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

export async function createCapture(params: CreateCaptureParams) {
  const { holdId, partnerId, creatorId, creatorEmail, projectId, projectName, amount } = params;

  const capture = await prisma.creditCapture.create({
    data: {
      holdId,
      partnerId,
      creatorId,
      creatorEmail,
      projectId,
      projectName,
      amount,
    },
  });

  return capture;
}

// ==============================================
// SETTLEMENT STATUS FUNCTIONS
// ==============================================

export async function approveSettlement(id: string, adminId: string) {
  return prisma.partnerSettlement.update({
    where: { id },
    data: {
      status: SettlementStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });
}

export async function processSettlement(id: string) {
  return prisma.partnerSettlement.update({
    where: { id },
    data: {
      status: SettlementStatus.PROCESSING,
    },
  });
}

export async function markSettlementPaid(id: string, paymentRef: string, paymentMethod?: string) {
  return prisma.partnerSettlement.update({
    where: { id },
    data: {
      status: SettlementStatus.PAID,
      paymentRef,
      paymentMethod,
      paidAt: new Date(),
    },
  });
}

export async function markSettlementFailed(id: string, reason?: string) {
  return prisma.partnerSettlement.update({
    where: { id },
    data: {
      status: SettlementStatus.FAILED,
      adminNotes: reason,
    },
  });
}

export async function disputeSettlement(id: string, reason: string) {
  return prisma.partnerSettlement.update({
    where: { id },
    data: {
      status: SettlementStatus.DISPUTED,
      disputeReason: reason,
    },
  });
}

// ==============================================
// SETTLEMENT GENERATION
// ==============================================

export async function generateSettlement(partnerId: string, periodStart: Date, periodEnd: Date) {
  // Get partner config
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, partnerFeePercent: true, minimumSettlement: true, paymentMethod: true },
  });

  if (!partner) {
    throw new Error('Partner not found');
  }

  // Get unsettled captures in the period
  const captures = await prisma.creditCapture.findMany({
    where: {
      partnerId,
      settlementId: null,
      capturedAt: { gte: periodStart, lte: periodEnd },
    },
  });

  if (captures.length === 0) {
    return null; // No captures to settle
  }

  // Calculate totals
  const grossAmount = captures.reduce((sum, c) => sum + Number(c.amount), 0);
  const feePercentage = Number(partner.partnerFeePercent);
  const partnerFee = grossAmount * feePercentage;
  const netAmount = grossAmount - partnerFee;

  // Check minimum
  if (netAmount < Number(partner.minimumSettlement)) {
    return null; // Below minimum threshold
  }

  // Create settlement and link captures
  const settlement = await prisma.partnerSettlement.create({
    data: {
      partnerId,
      periodStart,
      periodEnd,
      grossAmount,
      partnerFee,
      feePercentage,
      netAmount,
      paymentMethod: partner.paymentMethod,
      captures: {
        connect: captures.map(c => ({ id: c.id })),
      },
    },
    include: {
      _count: { select: { captures: true } },
    },
  });

  return settlement;
}

export async function generateAllSettlements(periodStart: Date, periodEnd: Date) {
  // Get all active partners with unsettled captures
  const partnersWithCaptures = await prisma.creditCapture.groupBy({
    by: ['partnerId'],
    where: {
      settlementId: null,
      capturedAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { amount: true },
  });

  const results = [];

  for (const p of partnersWithCaptures) {
    try {
      const settlement = await generateSettlement(p.partnerId, periodStart, periodEnd);
      if (settlement) {
        results.push({ partnerId: p.partnerId, settlementId: settlement.id, success: true });
      }
    } catch (error) {
      results.push({ partnerId: p.partnerId, success: false, error: String(error) });
    }
  }

  return results;
}
