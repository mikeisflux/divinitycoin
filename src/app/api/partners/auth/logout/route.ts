// app/api/partners/auth/logout/route.ts
// Partner logout API

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest, logoutPartner } from '@/lib/partner/auth';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (partner) {
      await logoutPartner(partner.partnerId);
    }

    // SECURITY: Must await cookies() in Next.js 14+
    const cookieStore = await cookies();
    cookieStore.delete('partner_session');

    return NextResponse.redirect(new URL('/partners/login', request.url));
  } catch (error) {
    logger.apiError('/api/partners/auth/logout', error);
    return NextResponse.redirect(new URL('/partners/login', request.url));
  }
}
