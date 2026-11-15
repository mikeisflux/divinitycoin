// POST /api/admin/auth/mfa/disable  { code }
// Requires a full session and a currently valid code (TOTP or recovery).
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAdmin, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { disableMfa } from '@/lib/admin/mfa';
import { isMfaRequiredForAll } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized || !auth.admin) return auth.response!;
    const { code } = await request.json().catch(() => ({}));
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'A current code is required to disable MFA' }, { status: 400 });
    }
    if (await isMfaRequiredForAll()) {
      return NextResponse.json({ error: 'MFA is required for all admins. Turn that off in Security settings before disabling your own.' }, { status: 400 });
    }
    const result = await disableMfa(auth.admin.id, code, { ipAddress: getClientIP(request), userAgent: getUserAgent(request) });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('MFA disable error:', error);
    return NextResponse.json({ error: 'Could not disable MFA' }, { status: 500 });
  }
}
