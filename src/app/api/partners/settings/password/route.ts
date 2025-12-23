// app/api/partners/settings/password/route.ts
// Partner password change

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest, verifyPartnerPassword, setPartnerPassword } from '@/lib/partner/auth';

export async function PUT(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPartnerPassword(partner.partnerId, currentPassword);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Set new password
    await setPartnerPassword(partner.partnerId, newPassword);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('Failed to change password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
