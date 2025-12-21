// app/api/partners/apply/route.ts
// Partner application submission endpoint

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/smtp';

interface PartnerApplicationData {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  businessName: string;
  businessType: string;
  taxId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  websiteUrl: string;
  platformDescription: string;
  expectedMonthlyVolume?: string;
  agreeToTerms: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: PartnerApplicationData = await request.json();

    // Validate required fields
    const requiredFields = [
      'contactName',
      'contactEmail',
      'businessName',
      'businessType',
      'taxId',
      'addressLine1',
      'city',
      'state',
      'zipCode',
      'country',
      'websiteUrl',
      'platformDescription',
    ];

    for (const field of requiredFields) {
      if (!body[field as keyof PartnerApplicationData]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    if (!body.agreeToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the terms of service' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check if partner with this email or business name already exists
    const existingPartner = await prisma.partner.findFirst({
      where: {
        OR: [
          { contactEmail: body.contactEmail },
          { name: body.businessName },
        ],
      },
    });

    if (existingPartner) {
      return NextResponse.json(
        { error: 'An application with this email or business name already exists' },
        { status: 409 }
      );
    }

    // Create slug from business name
    const slug = body.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug exists
    const existingSlug = await prisma.partner.findUnique({
      where: { slug },
    });

    const finalSlug = existingSlug
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    // Create partner application
    const partner = await prisma.partner.create({
      data: {
        name: body.businessName,
        slug: finalSlug,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        website: body.websiteUrl,
        description: body.platformDescription,
        status: 'PENDING',
        settings: {
          phone: body.contactPhone || null,
          businessType: body.businessType,
          taxId: body.taxId,
          address: {
            line1: body.addressLine1,
            line2: body.addressLine2 || null,
            city: body.city,
            state: body.state,
            zipCode: body.zipCode,
            country: body.country,
          },
          expectedMonthlyVolume: body.expectedMonthlyVolume || null,
          applicationDate: new Date().toISOString(),
        },
      },
    });

    // Send confirmation email to applicant
    await sendEmail({
      to: body.contactEmail,
      toName: body.contactName,
      subject: 'DivinityCoin Partner Application Received',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                  <div style="width: 40px; height: 40px; background-color: #6366f1; border-radius: 8px; display: inline-block; text-align: center; line-height: 40px;">
                    <span style="color: white; font-weight: bold; font-size: 20px;">D</span>
                  </div>
                </div>
              </div>

              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                Application Received
              </h1>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Hi ${body.contactName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                Thank you for your interest in becoming a DivinityCoin partner! We've received your application for <strong>${body.businessName}</strong>.
              </p>

              <div style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  What happens next?
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                  <li>Our team will review your application</li>
                  <li>We'll verify your business information</li>
                  <li>You'll receive your API credentials within 2-3 business days</li>
                </ol>
              </div>

              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                If you have any questions in the meantime, feel free to reach out to <a href="mailto:partners@divinitycoin.com" style="color: #6366f1;">partners@divinitycoin.com</a>
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} DivinityCoin. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `
Hi ${body.contactName},

Thank you for your interest in becoming a DivinityCoin partner! We've received your application for ${body.businessName}.

What happens next?
1. Our team will review your application
2. We'll verify your business information
3. You'll receive your API credentials within 2-3 business days

If you have any questions in the meantime, feel free to reach out to partners@divinitycoin.com

© ${new Date().getFullYear()} DivinityCoin. All rights reserved.
      `,
    });

    // Send notification to admin
    const adminEmail = process.env.ADMIN_INITIAL_EMAIL || 'divinitycomicsinc@gmail.com';
    await sendEmail({
      to: adminEmail,
      subject: `New Partner Application: ${body.businessName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>New Partner Application</h2>
  <table style="border-collapse: collapse; width: 100%;">
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Business Name</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.businessName}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contact Name</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.contactName}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.contactEmail}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.contactPhone || 'N/A'}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Business Type</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.businessType}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tax ID</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.taxId}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Website</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${body.websiteUrl}">${body.websiteUrl}</a></td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Address</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.addressLine1}${body.addressLine2 ? ', ' + body.addressLine2 : ''}, ${body.city}, ${body.state} ${body.zipCode}, ${body.country}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Expected Volume</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.expectedMonthlyVolume || 'Not specified'}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Description</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${body.platformDescription}</td></tr>
  </table>
  <p style="margin-top: 20px;">
    <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://divinitycoin.com'}/admin/partners" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
      Review in Admin Panel
    </a>
  </p>
</body>
</html>
      `,
      text: `New Partner Application\n\nBusiness: ${body.businessName}\nContact: ${body.contactName} (${body.contactEmail})\nWebsite: ${body.websiteUrl}\n\nReview in admin panel.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      partnerId: partner.id,
    });
  } catch (error) {
    console.error('Partner application error:', error);
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}
