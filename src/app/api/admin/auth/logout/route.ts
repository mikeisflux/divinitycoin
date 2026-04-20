// app/api/admin/auth/logout/route.ts
// Admin logout API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { logoutAdmin } from '@/lib/admin/auth';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// Uses cookies(); never pre-render during build.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Must await cookies() in Next.js 14+
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (token) {
      await logoutAdmin(token);
    }

    cookieStore.delete('admin_session');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('/api/admin/auth/logout', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
