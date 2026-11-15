// POST /api/admin/auth/mfa/setup
// Begin enrolment: issue a pending secret and the QR code for it. Accepts a
// full session (enrolling voluntarily from Settings) or an enrol challenge
// (REQUIRE_MFA is on and this admin has not enrolled yet).
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { resolveMfaPrincipal, beginEnrollment } from '@/lib/admin/mfa';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const principal = await resolveMfaPrincipal();
    if (!principal) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (principal.via === 'challenge' && principal.challenge.purpose !== 'enroll') {
      return NextResponse.json({ error: 'This sign-in is waiting for a code, not enrolment' }, { status: 400 });
    }
    if (principal.admin.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is already enabled. Disable it first to re-enrol.' }, { status: 400 });
    }
    if (!process.env.ENCRYPTION_SECRET) {
      return NextResponse.json({ error: 'ENCRYPTION_SECRET is not configured on the server; MFA secrets cannot be stored.' }, { status: 503 });
    }
    const { otpauthUrl, qrDataUrl, secret } = await beginEnrollment(principal.admin);
    return NextResponse.json({ success: true, otpauthUrl, qrDataUrl, secret, issuer: 'DivinityCoin Admin', account: principal.admin.email });
  } catch (error) {
    logger.apiError('MFA setup error:', error);
    return NextResponse.json({ error: 'Could not start enrolment' }, { status: 500 });
  }
}
