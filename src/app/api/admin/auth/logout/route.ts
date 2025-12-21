// app/api/admin/auth/logout/route.ts
// Admin logout API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { logoutAdmin } from '@/lib/admin/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (token) {
      await logoutAdmin(token);
    }

    cookieStore.delete('admin_session');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
