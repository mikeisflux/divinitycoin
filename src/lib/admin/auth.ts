// lib/admin/auth.ts
// Admin authentication utilities

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { logSecurityEvent } from '@/lib/security/events';
import { getConfig } from '@/lib/config';

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

  // When MFA is required for everyone, an unenrolled admin's existing
  // session stops being valid; the next sign-in walks them through
  // enrolment. The MFA routes themselves authenticate with a challenge
  // cookie, not a session, so this cannot lock anyone out of enrolling.
  if (!session.admin.mfaEnabled && (await isMfaRequiredForAll())) {
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
  // SECURITY: Must await cookies() in Next.js 14+
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;

  if (!sessionToken) return null;

  return validateAdminSession(sessionToken);
}

export async function loginAdmin(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string
): Promise<{ success: boolean; token?: string; error?: string; admin?: AdminUser; mfaRequired?: boolean; mfaEnrollmentRequired?: boolean }> {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    void logSecurityEvent({ type: 'LOGIN_FAILED', severity: 'warn', realm: 'admin', subject: email, ipAddress, userAgent, details: { reason: 'unknown_email' } });
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if locked out
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    void logSecurityEvent({ type: 'LOGIN_FAILED', severity: 'warn', realm: 'admin', subject: email, ipAddress, userAgent, details: { reason: 'locked', remainingMinutes } });
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
    void logSecurityEvent({ type: 'LOGIN_FAILED', severity: 'warn', realm: 'admin', subject: email, ipAddress, userAgent, details: { reason: 'bad_password', failedAttempts } });

    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      void logSecurityEvent({ type: 'LOCKOUT', severity: 'critical', realm: 'admin', subject: email, ipAddress, userAgent, details: { failedAttempts, minutes: LOCKOUT_DURATION_MINUTES } });
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

  const publicAdmin: AdminUser = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    mfaEnabled: admin.mfaEnabled,
  };

  // The password is right. Whether that is enough depends on MFA:
  //  - enrolled: the caller must pass a TOTP or recovery code first
  //  - not enrolled but REQUIRE_MFA is on: the caller must enrol first
  //  - otherwise: issue the session now
  // In the first two cases no session exists yet; the route hands out a
  // short-lived challenge instead (see lib/admin/mfa.ts).
  if (admin.mfaEnabled) {
    return { success: true, admin: publicAdmin, mfaRequired: true };
  }
  if (await isMfaRequiredForAll()) {
    return { success: true, admin: publicAdmin, mfaEnrollmentRequired: true };
  }

  const token = await issueAdminSession(admin.id, email, ipAddress, userAgent);
  return { success: true, token, admin: publicAdmin };
}

/** REQUIRE_MFA from system config (Settings → Security), env as fallback. */
export async function isMfaRequiredForAll(): Promise<boolean> {
  return (await getConfig('REQUIRE_MFA', process.env.REQUIRE_MFA || 'false')) === 'true';
}

/**
 * The one place an admin session is created. loginAdmin calls it when no
 * second factor is needed; the MFA verify and confirm routes call it once
 * the second factor has been satisfied.
 */
export async function issueAdminSession(
  adminId: string,
  email: string,
  ipAddress: string,
  userAgent: string,
): Promise<string> {
  const token = await createAdminSession(adminId, ipAddress, userAgent);
  void logSecurityEvent({ type: 'LOGIN_SUCCESS', realm: 'admin', subject: email, ipAddress, userAgent });
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      details: JSON.stringify({ email, ipAddress }),
      ipAddress,
      userAgent,
    },
  });
  return token;
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

/**
 * Settlement approval, processing and marking paid move partner money.
 * Until this existed any admin session could do it, including SUPPORT and
 * VIEWER. Least privilege on high-impact business APIs is the FBI's ARTEX
 * guidance verbatim; it is also just correct.
 */
export function canManageSettlements(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(role);
}

export function canManageSettings(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role);
}
