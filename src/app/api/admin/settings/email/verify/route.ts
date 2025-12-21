// app/api/admin/settings/email/verify/route.ts
// Verify SendGrid configuration

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { verifySendGridConnection } from '@/lib/email/sendgrid';

export async function POST(request: NextRequest) {
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  try {
    const result = await verifySendGridConnection();

    await logAdminAction(
      admin!.id,
      'SENDGRID_CONNECTION_VERIFIED',
      'email',
      undefined,
      { success: result.success, error: result.error || null },
      getClientIP(request),
      getUserAgent(request)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'SendGrid configuration invalid' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to verify SendGrid configuration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Configuration verification failed' },
      { status: 500 }
    );
  }
}
