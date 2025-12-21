// app/api/partners/auth/login/route.ts
// Partner login API

import { NextRequest, NextResponse } from 'next/server';
import { loginPartner } from '@/lib/partner/auth';
import { cookies } from 'next/headers';

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const result = await loginPartner(email, password, ipAddress, userAgent);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set session cookie
    const cookieStore = cookies();
    cookieStore.set('partner_session', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return NextResponse.json({
      success: true,
      partner: result.partner,
    });
  } catch (error) {
    console.error('Partner login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
