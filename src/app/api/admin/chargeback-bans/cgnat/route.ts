// app/api/admin/chargeback-bans/cgnat/route.ts
// List + add CGNAT IPs to ignore in the prefilter.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized) return response;
  try {
    const rows = await prisma.chargebackBanCgnatIp.findMany({
      orderBy: { createdAt: 'desc' },
      include: { addedBy: { select: { name: true, email: true } } },
    });
    return NextResponse.json({
      ips: rows.map((r) => ({
        id: r.id,
        ipAddress: r.ipAddress,
        note: r.note,
        addedBy: r.addedBy?.name ?? r.addedBy?.email ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/cgnat', error);
    return NextResponse.json({ error: 'Failed to load CGNAT allowlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized || !admin) return response;
  try {
    const body = await request.json();
    const ipAddress = (body?.ipAddress as string | undefined)?.trim().toLowerCase();
    const note = (body?.note as string | undefined) ?? null;
    if (!ipAddress) {
      return NextResponse.json({ error: 'ipAddress required' }, { status: 400 });
    }
    const row = await prisma.chargebackBanCgnatIp.upsert({
      where: { ipAddress },
      create: { ipAddress, note, addedById: admin.id },
      update: { note },
    });
    await logAdminAction(
      admin.id,
      'CHARGEBACK_BAN_CGNAT_ADDED',
      'chargebackBanCgnatIp',
      row.id,
      { ipAddress, note },
      getClientIP(request),
      getUserAgent(request),
    );
    return NextResponse.json({ success: true, id: row.id });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/cgnat:POST', error);
    return NextResponse.json({ error: 'Failed to add CGNAT entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized || !admin) return response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const existing = await prisma.chargebackBanCgnatIp.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.chargebackBanCgnatIp.delete({ where: { id } });
    await logAdminAction(
      admin.id,
      'CHARGEBACK_BAN_CGNAT_REMOVED',
      'chargebackBanCgnatIp',
      id,
      { ipAddress: existing.ipAddress },
      getClientIP(request),
      getUserAgent(request),
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/cgnat:DELETE', error);
    return NextResponse.json({ error: 'Failed to delete CGNAT entry' }, { status: 500 });
  }
}
