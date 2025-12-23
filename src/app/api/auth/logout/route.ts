// app/api/auth/logout/route.ts
// User logout endpoint

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/user';

export async function POST() {
  try {
    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
