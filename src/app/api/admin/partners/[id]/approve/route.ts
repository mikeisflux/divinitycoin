// app/api/admin/partners/[id]/approve/route.ts
// Approve partner and send onboarding email

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendgrid';
import { getConfig } from '@/lib/config';
import crypto from 'crypto';

async function sendPartnerOnboardingEmail(
  partnerName: string,
  contactName: string,
  contactEmail: string,
  setupUrl: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = await getConfig('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; border-bottom: 1px solid #e6ebf1;">
        <span style="color: #6366f1; font-size: 24px; font-weight: 700;">DivinityCoin</span>
      </div>

      <div style="padding: 30px;">
        <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 20px;">Welcome to the Partner Program!</h1>

        <p style="color: #525f7f; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
          Hi ${contactName || 'Partner'},
        </p>

        <p style="color: #525f7f; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
          Great news! Your partner application for <strong>${partnerName}</strong> has been approved.
          You're now ready to complete your account setup and start integrating DivinityCoin.
        </p>

        <div style="text-align: center; margin: 30px 0 15px;">
          <a href="${setupUrl}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Complete Account Setup
          </a>
        </div>

        <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 0 0 20px; text-align: center;">
          This link expires in 7 days. If you need a new link, please contact support.
        </p>

        <div style="margin: 30px 0;">
          <h3 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px;">What's Next?</h3>

          <div style="display: flex; align-items: flex-start; margin: 12px 0;">
            <span style="background: #6366f1; color: #ffffff; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 14px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">1</span>
            <span style="color: #525f7f; font-size: 15px; line-height: 22px;"><strong>Create Your Password</strong> - Set up secure access to your partner portal</span>
          </div>

          <div style="display: flex; align-items: flex-start; margin: 12px 0;">
            <span style="background: #6366f1; color: #ffffff; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 14px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">2</span>
            <span style="color: #525f7f; font-size: 15px; line-height: 22px;"><strong>Confirm Company Details</strong> - Review and update your business information</span>
          </div>

          <div style="display: flex; align-items: flex-start; margin: 12px 0;">
            <span style="background: #6366f1; color: #ffffff; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 14px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">3</span>
            <span style="color: #525f7f; font-size: 15px; line-height: 22px;"><strong>Set Up Payouts</strong> - Add your bank details for settlement payments</span>
          </div>

          <div style="display: flex; align-items: flex-start; margin: 12px 0;">
            <span style="background: #6366f1; color: #ffffff; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 14px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">4</span>
            <span style="color: #525f7f; font-size: 15px; line-height: 22px;"><strong>Get API Keys</strong> - Generate credentials and start integrating</span>
          </div>
        </div>

        <div style="background: #f0f9ff; border-radius: 8px; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #6366f1;">
          <p style="color: #1a1a1a; font-size: 15px; font-weight: 600; margin: 0 0 10px;">Settlement Details</p>
          <p style="color: #525f7f; font-size: 14px; line-height: 22px; margin: 4px 0;">• 6% platform fee on all credit transactions</p>
          <p style="color: #525f7f; font-size: 14px; line-height: 22px; margin: 4px 0;">• Weekly settlements (or custom frequency)</p>
          <p style="color: #525f7f; font-size: 14px; line-height: 22px; margin: 4px 0;">• Direct deposit to your bank account</p>
        </div>

        <p style="color: #525f7f; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
          Need help? Our developer support team is here to assist with your integration.
        </p>
      </div>

      <div style="border-top: 1px solid #e6ebf1; padding: 20px 30px; text-align: center;">
        <p style="color: #8898aa; font-size: 13px; margin: 4px 0;">
          Questions? Contact us at <a href="mailto:partners@divinitycoin.com" style="color: #6366f1; text-decoration: none;">partners@divinitycoin.com</a>
        </p>
        <p style="color: #8898aa; font-size: 13px; margin: 4px 0;">
          &copy; ${new Date().getFullYear()} DivinityCoin. All rights reserved.
        </p>
      </div>
    </div>
  `;

  const text = `
Welcome to the Partner Program!

Hi ${contactName || 'Partner'},

Great news! Your partner application for ${partnerName} has been approved.
You're now ready to complete your account setup and start integrating DivinityCoin.

Complete Account Setup: ${setupUrl}

This link expires in 7 days. If you need a new link, please contact support.

What's Next?
1. Create Your Password - Set up secure access to your partner portal
2. Confirm Company Details - Review and update your business information
3. Set Up Payouts - Add your bank details for settlement payments
4. Get API Keys - Generate credentials and start integrating

Settlement Details:
• 6% platform fee on all credit transactions
• Weekly settlements (or custom frequency)
• Direct deposit to your bank account

Need help? Contact partners@divinitycoin.com
  `.trim();

  return sendEmail({
    to: contactEmail,
    toName: contactName || partnerName,
    subject: `Welcome to DivinityCoin Partner Program - Complete Your Setup`,
    html,
    text,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await getAdminFromRequest();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and ADMIN can approve partners
    if (!['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    if (partner.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Partner is already active' }, { status: 400 });
    }

    // Generate setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update partner
    const settings = (partner.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...settings,
      setupToken,
      setupTokenExpires: setupTokenExpires.toISOString(),
      approvedBy: admin.id,
      approvedAt: new Date().toISOString(),
    };

    await prisma.partner.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        settings: updatedSettings,
      },
    });

    // Generate setup URL
    const baseUrl = await getConfig('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_APP_URL || 'https://divinitycoin.com');
    const setupUrl = `${baseUrl}/partners/setup?token=${setupToken}`;

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'partner.approve',
        resource: 'Partner',
        resourceId: id,
        details: JSON.stringify({
          partnerName: partner.name,
          contactEmail: partner.contactEmail,
        }),
      },
    });

    // Send onboarding email
    let emailSent = false;
    let emailError: string | undefined;

    if (partner.contactEmail) {
      const emailResult = await sendPartnerOnboardingEmail(
        partner.name,
        partner.contactName || '',
        partner.contactEmail,
        setupUrl
      );
      emailSent = emailResult.success;
      emailError = emailResult.error;
    }

    return NextResponse.json({
      success: true,
      setupUrl,
      emailSent,
      emailError,
      message: emailSent
        ? 'Partner approved and onboarding email sent.'
        : 'Partner approved. Setup link generated (email not sent).',
    });
  } catch (error) {
    console.error('Failed to approve partner:', error);
    return NextResponse.json({ error: 'Failed to approve partner' }, { status: 500 });
  }
}
