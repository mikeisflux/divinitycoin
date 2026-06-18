// app/api/admin/disputes/cases/route.ts
// List dispute cases (GET) — the tracking log shown on /admin/disputes.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);
  if (!authorized) return response;

  try {
    const cases = await prisma.disputeCase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({
      cases: cases.map((c) => ({
        id: c.id,
        transactionRef: c.transactionRef,
        paymentIntentId: c.paymentIntentId,
        vrolCase: c.vrolCase,
        partnerName: c.partnerName,
        amountCents: c.amountCents,
        currency: c.currency,
        customerEmail: c.customerEmail,
        status: c.status,
        bundleCount: c.bundleCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.apiError('/api/admin/disputes/cases', error);
    return NextResponse.json({ error: 'Failed to load dispute cases' }, { status: 500 });
  }
}
