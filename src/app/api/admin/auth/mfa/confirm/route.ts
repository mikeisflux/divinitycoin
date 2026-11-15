// POST /api/admin/auth/mfa/confirm  { code }
// Finish enrolment by proving the authenticator produces the right code.
// Returns the recovery codes — the only time they are ever shown. When the
// caller arrived via an enrol challenge, this also completes their sign-in.
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { issueAdminSession } from '@/lib/admin/auth';
import { resolveMfaPrincipal, confirmEnrollment, consumeMfaChallenge, recordChallengeFailure } from '@/lib/admin/mfa';
import { clearChallengeCookie, setSessionCookie } from '../_shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json().catch(() => ({}));
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    const principal = await resolveMfaPrincipal();
    if (!principal) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (principal.via === 'challenge' && principal.challenge.purpose !== 'enroll') {
      return NextResponse.json({ error: 'This sign-in is waiting for a code, not enrolment' }, { status: 400 });
    }
    const ctx = { ipAddress: getClientIP(request), userAgent: getUserAgent(request) };
    const result = await confirmEnrollment(principal.admin.id, code, ctx);
    if (!result.ok) {
      if (principal.via === 'challenge') {
        const alive = await recordChallengeFailure(principal.challenge.id);
        if (!alive) {
          await clearChallengeCookie();
          return NextResponse.json({ error: 'Too many incorrect codes. Sign in again.', restart: true }, { status: 401 });
        }
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    let signedIn = false;
    if (principal.via === 'challenge') {
      await consumeMfaChallenge(principal.challenge.id);
      const token = await issueAdminSession(principal.admin.id, principal.admin.email, ctx.ipAddress, ctx.userAgent);
      await setSessionCookie(token);
      await clearChallengeCookie();
      signedIn = true;
    }
    return NextResponse.json({ success: true, recoveryCodes: result.recoveryCodes, signedIn });
  } catch (error) {
    logger.apiError('MFA confirm error:', error);
    return NextResponse.json({ error: 'Could not complete enrolment' }, { status: 500 });
  }
}
