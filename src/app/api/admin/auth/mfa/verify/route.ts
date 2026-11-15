// POST /api/admin/auth/mfa/verify  { code }
// Second step of sign-in for an MFA-enrolled admin. Exchanges the challenge
// cookie for a real session on a valid TOTP or recovery code.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { issueAdminSession } from '@/lib/admin/auth';
import { MFA_CHALLENGE_COOKIE, getMfaChallenge, recordChallengeFailure, consumeMfaChallenge, verifyMfaCode } from '@/lib/admin/mfa';
import { clearChallengeCookie, setSessionCookie } from '../_shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json().catch(() => ({}));
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    const store = await cookies();
    const challenge = await getMfaChallenge(store.get(MFA_CHALLENGE_COOKIE)?.value);
    if (!challenge || challenge.purpose !== 'login') {
      await clearChallengeCookie();
      return NextResponse.json({ error: 'Sign-in expired. Start again.', restart: true }, { status: 401 });
    }
    const ctx = { ipAddress: getClientIP(request), userAgent: getUserAgent(request) };
    const result = await verifyMfaCode(challenge.admin.id, code, ctx);
    if (!result.ok) {
      const stillAlive = await recordChallengeFailure(challenge.id);
      if (!stillAlive) {
        await clearChallengeCookie();
        return NextResponse.json({ error: 'Too many incorrect codes. Sign in again.', restart: true }, { status: 401 });
      }
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    await consumeMfaChallenge(challenge.id);
    const token = await issueAdminSession(challenge.admin.id, challenge.admin.email, ctx.ipAddress, ctx.userAgent);
    await setSessionCookie(token);
    await clearChallengeCookie();
    return NextResponse.json({
      success: true,
      method: result.method,
      recoveryCodesRemaining: result.recoveryCodesRemaining,
      admin: challenge.admin,
    });
  } catch (error) {
    logger.apiError('MFA verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
