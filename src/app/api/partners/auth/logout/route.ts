// app/api/partners/auth/logout/route.ts
// Partner logout API

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest, logoutPartner } from '@/lib/partner/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (partner) {
      await logoutPartner(partner.partnerId);
    }

    const cookieStore = cookies();
    cookieStore.delete('partner_session');

    return NextResponse.redirect(new URL('/partners/login', request.url));
  } catch (error) {
    console.error('Partner logout error:', error);
    return NextResponse.redirect(new URL('/partners/login', request.url));
  }
}
