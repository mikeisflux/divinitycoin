// app/api/admin/disputes/bundle/route.ts
// Streams a zip of chargeback-evidence files for a transaction.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { buildEvidenceBundle } from '@/lib/dispute/bundle';
import { prisma } from '@/lib/db';
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
        bundleSize: result.pdf.length,
      },
      getClientIP(request),
      getUserAgent(request),
    );

    // Log (or update) a DisputeCase row so the admin has a tracking list
    // they can manage and delete when the dispute is resolved. Keyed on
    // the pasted transactionRef so regenerating a kit bumps the existing
    // row's bundleCount rather than creating a duplicate.
    const ev = result.evidence;
    try {
      const existing = await prisma.disputeCase.findFirst({
        where: { transactionRef: id },
      });
      if (existing) {
        await prisma.disputeCase.update({
          where: { id: existing.id },
          data: {
            bundleCount: { increment: 1 },
            vrolCase: vrolCase ?? existing.vrolCase,
          },
        });
      } else {
        await prisma.disputeCase.create({
          data: {
            transactionRef: id,
            paymentIntentId: ev.paymentIntentId,
            vrolCase: vrolCase ?? null,
            partnerId: ev.partner?.id ?? null,
            partnerName: ev.partner?.name ?? null,
            amountCents: ev.amountCents,
            currency: ev.currency,
            customerEmail: ev.email,
            createdByAdminId: admin.id,
          },
        });
      }
    } catch (logErr) {
      // Non-fatal — the kit still downloads even if the tracking row fails.
      logger.warn('Failed to upsert DisputeCase record', { error: logErr, id });
    }

    return new NextResponse(result.pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.pdf.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Failed to generate dispute evidence bundle', {
      id,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to generate evidence bundle' }, { status: 500 });
  }
}
