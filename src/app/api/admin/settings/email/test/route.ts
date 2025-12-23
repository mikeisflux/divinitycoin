// app/api/admin/settings/email/test/route.ts
// Send test email via SendGrid

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { sendTestEmail } from '@/lib/email/sendgrid';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const result = await sendTestEmail(email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send test email' },
        { status: 500 }
      );
    }

    await logAdminAction(
      admin!.id,
      'TEST_EMAIL_SENT',
      'email',
      undefined,
      { to: email },
      getClientIP(request),
      getUserAgent(request)
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.apiError('Failed to send test email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    );
  }
}
