// app/api/admin/settings/email/verify/route.ts
// Verify SMTP connection

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { verifySmtpConnection } from '@/lib/email/smtp';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const result = await verifySmtpConnection();

    await logAdminAction(
      admin!.id,
      'SMTP_CONNECTION_VERIFIED',
      'email',
      undefined,
      { success: result.success, error: result.error || null },
      getClientIP(request),
      getUserAgent(request)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'SMTP connection failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to verify SMTP connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection verification failed' },
      { status: 500 }
    );
  }
}
