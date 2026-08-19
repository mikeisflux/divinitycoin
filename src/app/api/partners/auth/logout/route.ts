// app/api/partners/auth/logout/route.ts
// Partner logout API. Aware of admin impersonation — if the current
// "partner_session" presented is actually an admin impersonating, only
// the impersonation cookie is cleared and the real partner's session
// is left intact. Otherwise behaves as a normal partner logout.

import { NextRequest, NextResponse } from 'next/server';
import {
  getPartnerFromRequest,
  getImpersonationFromRequest,
  clearImpersonationSession,
  logoutPartner,
} from '@/lib/partner/auth';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// Uses cookies(); never pre-render during build.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Admin impersonation takes precedence — if the impersonation
    // cookie is present and valid, this "logout" only ends the
    // impersonation. The real partner's session token on
    // Partner.settings is NOT touched, so a partner who is mid-flow
    // doesn't get kicked when an admin happens to be debugging as them.
    const impersonation = await getImpersonationFromRequest();
    if (impersonation) {
      const { partnerId } = impersonation.partnerUser;
      // Clear the cookie first. If clearImpersonationSession throws, the
      // admin must still drop out of impersonation rather than being left
      // inside it by a failed cleanup.
      cookieStore.delete('partner_impersonation_session');
      await clearImpersonationSession(partnerId);
      logger.info('Partner "Sign Out" ended admin impersonation', {
        partnerId,
        adminId: impersonation.adminId,
      });
      return NextResponse.redirect(
        new URL(`/admin/partners/${partnerId}`, request.url),
      );
    }

    // Real partner logout.
    const partner = await getPartnerFromRequest();
    if (partner) {
      await logoutPartner(partner.partnerId);
    }
    cookieStore.delete('partner_session');

    return NextResponse.redirect(new URL('/partners/login', request.url));
  } catch (error) {
    logger.apiError('/api/partners/auth/logout', error);
    return NextResponse.redirect(new URL('/partners/login', request.url));
  }
}
