// app/api/admin/disputes/cases/[id]/route.ts
// Update status (PATCH) or delete (DELETE) a tracked dispute case.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { DisputeStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = Object.values(DisputeStatus);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);
  if (!authorized || !admin) return response;

  try {
    const body = await request.json();
    const status = body?.status as string | undefined;
    const notes = body?.notes as string | undefined;

    const data: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as DisputeStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = status;
    }
    if (notes !== undefined) data.notes = notes;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.disputeCase.update({
      where: { id: params.id },
      data,
    });

    await logAdminAction(
      admin.id,
      'DISPUTE_CASE_UPDATED',
      'disputeCase',
      params.id,
      data,
      getClientIP(request),
      getUserAgent(request),
    );

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    logger.error('Failed to update dispute case', { error, id: params.id });
    return NextResponse.json({ error: 'Failed to update dispute case' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'FINANCE']);
  if (!authorized || !admin) return response;

  try {
    const existing = await prisma.disputeCase.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Dispute case not found' }, { status: 404 });
    }

    await prisma.disputeCase.delete({ where: { id: params.id } });

    await logAdminAction(
      admin.id,
      'DISPUTE_CASE_DELETED',
      'disputeCase',
      params.id,
      { transactionRef: existing.transactionRef, vrolCase: existing.vrolCase },
      getClientIP(request),
      getUserAgent(request),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete dispute case', { error, id: params.id });
    return NextResponse.json({ error: 'Failed to delete dispute case' }, { status: 500 });
  }
}
