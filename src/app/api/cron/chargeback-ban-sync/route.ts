// app/api/cron/chargeback-ban-sync/route.ts
// Cron endpoint to poll partner chargeback-ban-signals feeds.
// Call every 5 minutes:
//   curl -X POST https://divinitycoin.com/api/cron/chargeback-ban-sync?secret=...
//
// Per-partner config (resolved via getConfig):
//   CHARGEBACK_BAN_PARTNER_SLUGS    "indiecrowdfund,otherpartner"
//   CHARGEBACK_BAN_FEED_URL__<SLUG> e.g. CHARGEBACK_BAN_FEED_URL__INDIECROWDFUND
//   CHARGEBACK_BAN_FEED_TOKEN__<SLUG>
// The default URL for indiecrowdfund matches the spec.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { syncBanFeed } from '@/lib/chargeback-ban/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_FEED_URLS: Record<string, string> = {
  'indiecrowdfund-com': 'https://indiecrowdfund.com/api/divinitycoin/chargeback-ban-signals',
};

async function authorizeCron(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = await getConfig('CRON_SECRET', '');
  if (!cronSecret) return null;
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('secret');
  const fromHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (fromQuery !== cronSecret && fromHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const unauth = await authorizeCron(request);
  if (unauth) return unauth;

  try {
    const slugsRaw = await getConfig('CHARGEBACK_BAN_PARTNER_SLUGS', 'indiecrowdfund');
    const slugs = slugsRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (slugs.length === 0) {
      return NextResponse.json({ success: true, results: [], note: 'No partners configured' });
    }

    const partners = await prisma.partner.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true, name: true },
    });

    const results = [] as Array<{
      partnerSlug: string;
      ok: boolean;
      signalsTotal?: number;
      signalsAdded?: number;
      signalsUpdated?: number;
      signalsRemoved?: number;
      error?: string;
    }>;

    for (const partner of partners) {
      const slugUpper = partner.slug.toUpperCase().replace(/-/g, '_');
      const feedUrl = await getConfig(
        `CHARGEBACK_BAN_FEED_URL__${slugUpper}`,
        DEFAULT_FEED_URLS[partner.slug.toLowerCase()] ?? '',
      );
      const feedToken = await getConfig(`CHARGEBACK_BAN_FEED_TOKEN__${slugUpper}`, '');
      if (!feedUrl || !feedToken) {
        results.push({
          partnerSlug: partner.slug,
          ok: false,
          error: 'Feed URL or token not configured',
        });
        continue;
      }
      const r = await syncBanFeed({ partnerId: partner.id, feedUrl, feedToken });
      results.push({
        partnerSlug: partner.slug,
        ok: r.ok,
        signalsTotal: r.signalsTotal,
        signalsAdded: r.signalsAdded,
        signalsUpdated: r.signalsUpdated,
        signalsRemoved: r.signalsRemoved,
        error: r.errorMessage,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    logger.apiError('/api/cron/chargeback-ban-sync', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
