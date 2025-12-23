// app/api/partners/apply/route.ts
// Partner application submission endpoint - saves directly to database for admin review

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    // SECURITY: Define field constraints to prevent DoS via large payloads
    const fieldLimits: Record<string, number> = {
      contactName: 255,
      contactEmail: 255,
      contactPhone: 50,
      businessName: 255,
      businessType: 100,
      taxId: 50,
      addressLine1: 255,
      addressLine2: 255,
      city: 100,
      state: 100,
      zipCode: 20,
      country: 100,
      websiteUrl: 500,
      platformDescription: 2000,
      expectedMonthlyVolume: 100,
    };

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

    // SECURITY: Validate field lengths to prevent DoS attacks
    for (const [field, maxLength] of Object.entries(fieldLimits)) {
      const value = body[field as keyof PartnerApplicationData];
      if (typeof value === 'string' && value.length > maxLength) {
        return NextResponse.json(
          { error: `${field} exceeds maximum length of ${maxLength} characters` },
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

    // Create partner application - goes directly to admin for review
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
