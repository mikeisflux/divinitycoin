// GET /api/admin/auth/mfa/status
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/middleware';
import { mfaStatus } from '@/lib/admin/mfa';
import { isMfaRequiredForAll } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized || !auth.admin) return auth.response!;
  const status = await mfaStatus(auth.admin.id);
  return NextResponse.json({ success: true, ...status, requiredForAll: await isMfaRequiredForAll(), email: auth.admin.email });
}
