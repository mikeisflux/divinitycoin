// app/api/auth/register/route.ts
// User registration endpoint

import { NextRequest, NextResponse } from 'next/server';
import { createUser, createSession, setSessionCookie, getUserByEmail } from '@/lib/auth/user';
import { logger } from '@/lib/logger';
import { apiRateLimiter, createRateLimitKey } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting to prevent enumeration attacks
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = createRateLimitKey('register', clientIP);
    const rateLimit = apiRateLimiter.check(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 60) },
        }
      );
    }

    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // SECURITY: Check if user already exists but return generic message
    // to prevent email enumeration attacks
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      // SECURITY: Return success even for existing users to prevent enumeration
      // In production, you would send an email saying "you already have an account"
      logger.info('Registration attempted for existing email', { emailDomain: email.split('@')[1] });
      return NextResponse.json({
        success: true,
        message: 'If this email is not already registered, check your inbox to complete registration.',
      });
    }

    // Create user
    const user = await createUser(email, password, name);

    // Create session
    const { token } = await createSession(user.id, request);
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      message: 'If this email is not already registered, check your inbox to complete registration.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.apiError('/api/auth/register', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
