// app/api/partners/captures/route.ts
// Partner captures API - list credit captures

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { getCaptures } from '@/lib/settlements';

export async function GET(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const settled = searchParams.get('settled');
    const creatorId = searchParams.get('creator_id') || undefined;
    const projectId = searchParams.get('project_id') || undefined;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parse dates if provided
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    // Parse settled filter
    let settledFilter: boolean | undefined;
    if (settled === 'true') settledFilter = true;
    else if (settled === 'false') settledFilter = false;

    const result = await getCaptures({
      partnerId: partner.partnerId,
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
        unsettledCount: result.summary.captureCount,
      },
      total: result.total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (error) {
    console.error('Failed to fetch captures:', error);
    return NextResponse.json({ error: 'Failed to fetch captures' }, { status: 500 });
  }
}
