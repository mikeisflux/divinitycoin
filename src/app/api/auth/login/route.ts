// app/api/auth/login/route.ts
// User login endpoint

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { validateLogin, createSession, setSessionCookie } from '@/lib/auth/user';
import { customerLoginLimiter } from '@/lib/rateLimit';
import { logSecurityEvent, ipFromHeaders } from '@/lib/security/events';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const ipAddress = ipFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent');
    const subject = String(email).toLowerCase();

    // Neither nginx's login zone nor the middleware limiter covers this
    // path, so until now it could be enumerated at whatever speed the
    // caller liked.
    const limit = customerLoginLimiter.check(`customer-login:${ipAddress || 'unknown'}`);
    if (!limit.allowed) {
      void logSecurityEvent({ type: 'RATE_LIMITED', severity: 'warn', realm: 'customer', subject, ipAddress, userAgent, details: { endpoint: '/api/auth/login' } });
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } }
      );
    }

    const user = await validateLogin(email, password);
    if (!user) {
      void logSecurityEvent({ type: 'LOGIN_FAILED', severity: 'warn', realm: 'customer', subject, ipAddress, userAgent });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    void logSecurityEvent({ type: 'LOGIN_SUCCESS', realm: 'customer', subject, ipAddress, userAgent });

    // Create session
    const { token } = await createSession(user.id, request);
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.apiError('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
