// app/api/admin/chargeback-bans/signals/route.ts
// List ban signals currently cached from partner feeds. Read-only —
// the feed is the source of truth, so admins can't edit signals here.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const includeRemoved = searchParams.get('includeRemoved') === '1';
    const partnerSlug = searchParams.get('partnerSlug')?.trim() || undefined;

    const signals = await prisma.chargebackBanSignal.findMany({
      where: {
        ...(includeRemoved ? {} : { removedAt: null }),
        ...(partnerSlug ? { partner: { slug: partnerSlug } } : {}),
      },
      orderBy: { bannedAt: 'desc' },
      take: 500,
      include: {
        partner: { select: { name: true, slug: true } },
        identifiers: { select: { type: true, value: true } },
      },
    });

    return NextResponse.json({
      signals: signals.map((s) => ({
        id: s.id,
        sourceUserId: s.sourceUserId,
        partnerName: s.partner.name,
        partnerSlug: s.partner.slug,
        bannedAt: s.bannedAt.toISOString(),
        reason: s.reason,
        lastSeenAt: s.lastSeenAt.toISOString(),
        removedAt: s.removedAt?.toISOString() ?? null,
        identifierCounts: s.identifiers.reduce<Record<string, number>>((acc, i) => {
          acc[i.type] = (acc[i.type] ?? 0) + 1;
          return acc;
        }, {}),
        identifiers: s.identifiers.map((i) => ({
          type: i.type,
          // Mask the right half of each value for the admin list.
          value: i.value.length > 6 ? i.value.slice(0, 4) + '…' + i.value.slice(-3) : i.value,
        })),
      })),
    });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/signals', error);
    return NextResponse.json({ error: 'Failed to load signals' }, { status: 500 });
  }
}
