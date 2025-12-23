// app/api/partners/api-keys/[id]/route.ts
// Partner API key revocation

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the key belongs to this partner
    const apiKey = await prisma.partnerApiKey.findFirst({
      where: {
        id: params.id,
        partnerId: partner.partnerId,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Revoke the key
    await prisma.partnerApiKey.update({
      where: { id: params.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Failed to revoke API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
