// app/api/partners/settings/webhook-secret/route.ts
// Regenerate partner webhook secret

import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate new webhook secret
    const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;

    await prisma.partner.update({
      where: { id: partner.partnerId },
      data: { webhookSecret: secret },
    });

    return NextResponse.json({ secret });
  } catch (error) {
    console.error('Failed to regenerate webhook secret:', error);
    return NextResponse.json({ error: 'Failed to regenerate secret' }, { status: 500 });
  }
}
