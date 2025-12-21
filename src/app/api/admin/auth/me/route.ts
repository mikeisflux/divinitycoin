// app/api/admin/auth/me/route.ts
// Get current admin user

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/middleware';

export async function GET(request: NextRequest) {
  const { authorized, admin, response } = await requireAdmin(request);

  if (!authorized) {
    return response;
  }

  return NextResponse.json({ admin });
}
