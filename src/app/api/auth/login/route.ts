// app/api/auth/login/route.ts
// User login endpoint

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { validateLogin, createSession, setSessionCookie } from '@/lib/auth/user';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await validateLogin(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

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
