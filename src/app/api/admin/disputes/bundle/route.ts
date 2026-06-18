// app/api/admin/disputes/bundle/route.ts
// Streams a zip of chargeback-evidence files for a transaction.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { buildEvidenceBundle } from '@/lib/dispute/bundle';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // pdfkit needs Node

export async function GET(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, [
    'SUPER_ADMIN', 'ADMIN', 'FINANCE',
  ]);
  if (!authorized || !admin) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();
  const vrolCase = searchParams.get('vrol')?.trim() || undefined;

  if (!id) {
    return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 });
  }

  try {
    const result = await buildEvidenceBundle(id, vrolCase);
    if (!result) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    await logAdminAction(
      admin.id,
      'DISPUTE_EVIDENCE_BUNDLE_GENERATED',
      'transaction',
      result.evidence.internalId,
      {
        paymentIntentId: result.evidence.paymentIntentId,
        source: result.evidence.source,
        vrolCase: vrolCase ?? null,
        bundleSize: result.zip.length,
      },
      getClientIP(request),
      getUserAgent(request),
    );

    return new NextResponse(result.zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.zip.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Failed to generate dispute evidence bundle', { error, id });
    return NextResponse.json({ error: 'Failed to generate evidence bundle' }, { status: 500 });
  }
}
