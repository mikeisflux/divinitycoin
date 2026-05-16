// app/api/admin/partners/[id]/impersonate/route.ts
// Admin "View as Partner" — mints an impersonation session for the
// target partner and redirects to the partner portal. The partner's
// own session (if any) is left intact in a separate storage slot.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireRole } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { createImpersonationSession } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // SUPER_ADMIN and ADMIN only — SUPPORT can view partner pages in /admin
  // but shouldn't be able to act AS a partner.
  const { authorized, response, admin } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized || !admin) return response;

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, status: true },
    });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const token = await createImpersonationSession(partner.id, admin.id, ipAddress, userAgent);

    await logAdminAction(
      admin.id,
      'IMPERSONATE_PARTNER_START',
      'partner',
      partner.id,
      { partnerName: partner.name, ipAddress },
      ipAddress,
      userAgent,
    );

    const cookieStore = await cookies();
    cookieStore.set('partner_impersonation_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    logger.info('Admin started partner impersonation', {
      adminId: admin.id,
      partnerId: partner.id,
      partnerName: partner.name,
    });

    return NextResponse.redirect(new URL('/partners/dashboard', request.url));
  } catch (error) {
    logger.apiError(`/api/admin/partners/${params.id}/impersonate`, error);
    return NextResponse.json({ error: 'Failed to start impersonation' }, { status: 500 });
  }
}
