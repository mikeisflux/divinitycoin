// app/api/admin/chargeback-bans/sync/route.ts
// Manual "Sync now" button trigger. Same logic as the cron route but
// scoped to a specific partner slug.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { syncBanFeed } from '@/lib/chargeback-ban/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_FEED_URLS: Record<string, string> = {
  'indiecrowdfund-com': 'https://indiecrowdfund.com/api/divinitycoin/chargeback-ban-signals',
};

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized || !admin) return response;

  try {
    const body = await request.json().catch(() => ({}));
    const partnerSlug = ((body?.partnerSlug as string | undefined) ?? '').trim().toLowerCase();
    if (!partnerSlug) {
      return NextResponse.json({ error: 'partnerSlug required' }, { status: 400 });
    }
    const partner = await prisma.partner.findUnique({
      where: { slug: partnerSlug },
      select: { id: true, slug: true },
    });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    const slugUpper = partner.slug.toUpperCase().replace(/-/g, '_');
    const feedUrl = await getConfig(
      `CHARGEBACK_BAN_FEED_URL__${slugUpper}`,
      DEFAULT_FEED_URLS[partner.slug.toLowerCase()] ?? '',
    );
    const feedToken = await getConfig(`CHARGEBACK_BAN_FEED_TOKEN__${slugUpper}`, '');
    if (!feedUrl || !feedToken) {
      return NextResponse.json(
        { error: `Feed URL or token not configured for partner "${partnerSlug}"` },
        { status: 400 },
      );
    }

    // An empty feed snapshot soft-deletes every active signal for the
    // partner, so the cron refuses it. An admin can opt in here when the
    // partner really has cleared their ban list.
    const allowEmptySnapshot = body?.allowEmptySnapshot === true;

    const result = await syncBanFeed({
      partnerId: partner.id,
      feedUrl,
      feedToken,
      allowEmptySnapshot,
    });
    await logAdminAction(
      admin.id,
      'CHARGEBACK_BAN_FEED_SYNC',
      'partner',
      partner.id,
      { ok: result.ok, total: result.signalsTotal, allowEmptySnapshot },
      getClientIP(request),
      getUserAgent(request),
    );
    return NextResponse.json({ success: result.ok, ...result });
  } catch (error) {
    logger.apiError('/api/admin/chargeback-bans/sync', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
