// app/api/admin/settings/email/test/route.ts
// Send test email

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

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

    // Get API key from database
    const apiKeyConfig = await prisma.systemConfig.findUnique({
      where: { key: 'SENDGRID_API_KEY' },
    });

    if (!apiKeyConfig?.value) {
      return NextResponse.json({ error: 'SendGrid API key not configured' }, { status: 400 });
    }

    const apiKey = apiKeyConfig.isEncrypted ? decrypt(apiKeyConfig.value) : apiKeyConfig.value;
    sgMail.setApiKey(apiKey);

    // Get sender info
    const [fromEmailConfig, fromNameConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: 'SENDGRID_FROM_EMAIL' } }),
      prisma.systemConfig.findUnique({ where: { key: 'SENDGRID_FROM_NAME' } }),
    ]);

    const fromEmail = fromEmailConfig?.value || process.env.SENDGRID_FROM_EMAIL;
    const fromName = fromNameConfig?.value || 'DivinityCoin';

    if (!fromEmail) {
      return NextResponse.json({ error: 'From email not configured' }, { status: 400 });
    }

    await sgMail.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      subject: 'DivinityCoin Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Test Email</h1>
          <p>This is a test email from DivinityCoin to verify your email configuration is working correctly.</p>
          <p style="color: #666; font-size: 14px;">
            Sent at: ${new Date().toISOString()}<br>
            From: ${fromEmail}<br>
            To: ${email}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated test email from the DivinityCoin admin panel.
          </p>
        </div>
      `,
      text: `DivinityCoin Test Email\n\nThis is a test email to verify your email configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
    });

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
  } catch (error: any) {
    console.error('Failed to send test email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}
