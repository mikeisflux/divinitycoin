// app/api/admin/admins/[id]/unlock/route.ts
// Unlock admin account API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminFromRequest, canManageAdmins } from '@/lib/admin/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminFromRequest();

    if (!admin || !canManageAdmins(admin.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Only super admins can unlock super admins
    if (targetAdmin.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot unlock Super Admin accounts' }, { status: 403 });
    }

    await prisma.adminUser.update({
      where: { id: params.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'UNLOCK_ADMIN',
        resource: 'AdminUser',
        resourceId: params.id,
        details: JSON.stringify({ email: targetAdmin.email }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlocking admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
