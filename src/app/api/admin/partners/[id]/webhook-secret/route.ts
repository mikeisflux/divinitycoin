// app/api/admin/partners/[id]/webhook-secret/route.ts
// Admin API to regenerate partner webhook secret

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Generate new webhook secret
    const webhookSecret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;

    await prisma.partner.update({
      where: { id: params.id },
      data: { webhookSecret },
    });

    await logAdminAction(
      admin!.id,
      'PARTNER_WEBHOOK_SECRET_REGENERATE',
      'partner',
      params.id,
      { partnerId: params.id },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({
      success: true,
      webhookSecret,
    });
  } catch (error) {
    logger.apiError('Failed to regenerate webhook secret:', error);
    return NextResponse.json({ error: 'Failed to regenerate webhook secret' }, { status: 500 });
  }
}
