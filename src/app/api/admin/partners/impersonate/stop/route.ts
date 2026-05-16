// app/api/admin/partners/impersonate/stop/route.ts
// "Exit impersonation" — clears the impersonation session and bounces
// the admin back to the partner detail page in /admin. Idempotent.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getImpersonationFromRequest,
  clearImpersonationSession,
} from '@/lib/partner/auth';
import { getAdminFromRequest, logAdminAction } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const impersonation = await getImpersonationFromRequest();
    const admin = await getAdminFromRequest();
    const cookieStore = await cookies();

    if (impersonation) {
      await clearImpersonationSession(impersonation.user.partnerId);

      if (admin) {
        await logAdminAction(
          admin.id,
          'IMPERSONATE_PARTNER_STOP',
          'partner',
          impersonation.user.partnerId,
          { partnerName: impersonation.user.partnerName },
          getClientIp(request),
          request.headers.get('user-agent') || 'unknown',
        );
      }

      logger.info('Admin stopped partner impersonation', {
        adminId: admin?.id ?? impersonation.adminId,
        partnerId: impersonation.user.partnerId,
      });
    }

    cookieStore.delete('partner_impersonation_session');

    // Send the admin back to the partner detail in /admin if we know
    // which partner; otherwise to the partners list.
    const target = impersonation
      ? new URL(`/admin/partners/${impersonation.user.partnerId}`, request.url)
      : new URL('/admin/partners', request.url);
    return NextResponse.redirect(target);
  } catch (error) {
    logger.apiError('/api/admin/partners/impersonate/stop', error);
    const cookieStore = await cookies();
    cookieStore.delete('partner_impersonation_session');
    return NextResponse.redirect(new URL('/admin/partners', request.url));
  }
}
