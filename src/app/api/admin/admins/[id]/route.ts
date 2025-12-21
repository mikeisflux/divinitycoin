// app/api/admin/admins/[id]/route.ts
// Single admin user management API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminFromRequest, canManageAdmins } from '@/lib/admin/auth';
import bcrypt from 'bcrypt';

export async function GET(
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json(targetAdmin);
  } catch (error) {
    console.error('Error fetching admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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

    // Only super admins can edit super admins
    if (targetAdmin.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot edit Super Admin accounts' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role, password } = body;

    const updateData: Record<string, unknown> = {};

    if (email && email !== targetAdmin.email) {
      // Check if email is already in use
      const existing = await prisma.adminUser.findFirst({
        where: { email, id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      updateData.email = email;
    }

    if (name !== undefined) {
      updateData.name = name || null;
    }

    if (role && role !== targetAdmin.role) {
      // Validate role
      const validRoles = ['VIEWER', 'SUPPORT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      // Only super admins can assign super admin role
      if (role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admins can assign Super Admin role' }, { status: 403 });
      }

      // Cannot change your own role
      if (params.id === admin.id) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
      }

      updateData.role = role;
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'UPDATE_ADMIN',
        resource: 'AdminUser',
        resourceId: params.id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json(updatedAdmin);
  } catch (error) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminFromRequest();

    if (!admin || !canManageAdmins(admin.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Cannot delete yourself
    if (params.id === admin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: params.id },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Only super admins can delete super admins
    if (targetAdmin.role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete Super Admin accounts' }, { status: 403 });
    }

    await prisma.adminUser.delete({
      where: { id: params.id },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'DELETE_ADMIN',
        resource: 'AdminUser',
        resourceId: params.id,
        details: JSON.stringify({ email: targetAdmin.email }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
