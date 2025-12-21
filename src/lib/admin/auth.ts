// lib/admin/auth.ts
// Admin authentication utilities

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createAdminSession(adminId: string, ipAddress: string, userAgent: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      adminId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return token;
}

export async function validateAdminSession(token: string): Promise<AdminUser | null> {
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.adminSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  // Update last activity
  await prisma.adminSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  });

  return {
    id: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    role: session.admin.role,
    mfaEnabled: session.admin.mfaEnabled,
  };
}

export async function getAdminFromRequest(): Promise<AdminUser | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;

  if (!sessionToken) return null;

  return validateAdminSession(sessionToken);
}

export async function loginAdmin(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string
): Promise<{ success: boolean; token?: string; error?: string; admin?: AdminUser }> {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if locked out
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      success: false,
      error: `Account locked. Try again in ${remainingMinutes} minutes.`,
    };
  }

  // Verify password
  const isValid = await verifyPassword(password, admin.passwordHash);

  if (!isValid) {
    // Increment failed attempts
    const failedAttempts = admin.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };

    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: updateData,
    });

    // Log failed attempt
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        details: JSON.stringify({ email, ipAddress }),
        ipAddress,
        userAgent,
      },
    });

    return { success: false, error: 'Invalid email or password' };
  }

  // Reset failed attempts and create session
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const token = await createAdminSession(admin.id, ipAddress, userAgent);

  // Log successful login
  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      details: JSON.stringify({ email, ipAddress }),
      ipAddress,
      userAgent,
    },
  });

  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      mfaEnabled: admin.mfaEnabled,
    },
  };
}

export async function logoutAdmin(token: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { token },
  });
}

export async function logAdminAction(
  adminId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: object,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
    },
  });
}

// Permission check helpers
export function canManagePartners(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role);
}

export function canManageAdmins(role: string): boolean {
  return role === 'SUPER_ADMIN';
}

export function canViewFinancials(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(role);
}

export function canProcessRefunds(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(role);
}

export function canManageGiftCards(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(role);
}

export function canViewUsers(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(role);
}

export function canManageSettings(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role);
}
