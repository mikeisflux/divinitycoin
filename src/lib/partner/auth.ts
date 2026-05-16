// lib/partner/auth.ts
// Partner authentication utilities

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_HOURS = 24;

export interface PartnerUser {
  id: string;
  partnerId: string;
  email: string;
  name: string;
  partnerName: string;
  partnerSlug: string;
  partnerStatus: string;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createPartnerSession(partnerId: string, ipAddress: string, userAgent: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  // Get existing settings to preserve them (especially passwordHash!)
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { settings: true },
  });

  const existingSettings = (partner?.settings as Record<string, unknown>) || {};

  // Merge session data with existing settings
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      settings: {
        ...existingSettings,
        sessionToken: token,
        sessionExpires: expiresAt.toISOString(),
        lastLoginIp: ipAddress,
        lastLoginAt: new Date().toISOString(),
      },
    },
  });

  return token;
}

export async function validatePartnerSession(token: string): Promise<PartnerUser | null> {
  if (!token) return null;

  // Find partner by session token
  const partners = await prisma.partner.findMany({
    where: {
      settings: {
        path: ['sessionToken'],
        equals: token,
      },
    },
  });

  if (partners.length === 0) return null;

  const partner = partners[0];
  const settings = partner.settings as any;

  if (!settings?.sessionExpires || new Date(settings.sessionExpires) < new Date()) {
    return null;
  }

  return {
    id: partner.id,
    partnerId: partner.id,
    email: partner.contactEmail || '',
    name: partner.contactName || '',
    partnerName: partner.name,
    partnerSlug: partner.slug,
    partnerStatus: partner.status,
  };
}

export async function getPartnerFromRequest(): Promise<PartnerUser | null> {
  // SECURITY: Must await cookies() in Next.js 14+
  const cookieStore = await cookies();

  // Admin impersonation takes precedence — when an admin is "viewing as"
  // a partner, the impersonation cookie holds a token that maps to the
  // target partner via a SEPARATE storage slot. This is deliberate so
  // the partner's real session in `sessionToken` is left untouched and
  // the partner doesn't get logged out mid-flow.
  const impersonationToken = cookieStore.get('partner_impersonation_session')?.value;
  if (impersonationToken) {
    const impersonated = await validateImpersonationSession(impersonationToken);
    if (impersonated) return impersonated.user;
  }

  const sessionToken = cookieStore.get('partner_session')?.value;
  if (!sessionToken) return null;

  return validatePartnerSession(sessionToken);
}

/**
 * Reads the impersonation cookie (if any) and returns details about
 * the active impersonation session — used by the partner-portal layout
 * to render the impersonation banner and by the stop endpoint to know
 * which partner to clear and return to.
 */
export async function getImpersonationFromRequest(): Promise<{
  partnerUser: PartnerUser;
  adminId: string;
  expiresAt: Date;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('partner_impersonation_session')?.value;
  if (!token) return null;
  return validateImpersonationSession(token);
}

/**
 * Create an admin-driven impersonation session for a partner. Stored on
 * the partner record in a dedicated slot so it doesn't collide with the
 * partner's own session token. The returned token is what gets set as
 * the partner_impersonation_session cookie.
 */
export async function createImpersonationSession(
  partnerId: string,
  adminId: string,
  ipAddress: string,
  userAgent: string,
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { settings: true },
  });
  const existingSettings = (partner?.settings as Record<string, unknown>) || {};

  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      settings: {
        ...existingSettings,
        impersonationToken: token,
        impersonationExpires: expiresAt.toISOString(),
        impersonationAdminId: adminId,
        impersonationStartedAt: new Date().toISOString(),
        impersonationIp: ipAddress,
        impersonationUserAgent: userAgent,
      },
    },
  });

  return token;
}

/**
 * Look up an impersonation session by its cookie token. Returns the
 * synthesized PartnerUser plus the admin who initiated the impersonation,
 * or null if the token is unknown / expired.
 */
export async function validateImpersonationSession(token: string): Promise<{
  user: PartnerUser;
  adminId: string;
  expiresAt: Date;
} | null> {
  if (!token) return null;

  const partners = await prisma.partner.findMany({
    where: {
      settings: {
        path: ['impersonationToken'],
        equals: token,
      },
    },
  });
  if (partners.length === 0) return null;

  const partner = partners[0];
  const settings = partner.settings as Record<string, unknown> | null;
  const expiresAtRaw = settings?.impersonationExpires as string | undefined;
  const adminId = settings?.impersonationAdminId as string | undefined;
  if (!expiresAtRaw || !adminId) return null;

  const expiresAt = new Date(expiresAtRaw);
  if (expiresAt < new Date()) return null;

  return {
    user: {
      id: partner.id,
      partnerId: partner.id,
      email: partner.contactEmail || '',
      name: partner.contactName || '',
      partnerName: partner.name,
      partnerSlug: partner.slug,
      partnerStatus: partner.status,
    },
    adminId,
    expiresAt,
  };
}

/**
 * Remove the impersonation session from a partner record. Called when
 * the admin clicks "Exit impersonation" — leaves the partner's own
 * session untouched.
 */
export async function clearImpersonationSession(partnerId: string): Promise<void> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });
  if (!partner) return;

  const settings = (partner.settings as Record<string, unknown>) || {};
  delete settings.impersonationToken;
  delete settings.impersonationExpires;
  delete settings.impersonationAdminId;
  delete settings.impersonationStartedAt;
  delete settings.impersonationIp;
  delete settings.impersonationUserAgent;

  await prisma.partner.update({
    where: { id: partnerId },
    data: { settings },
  });
}

export async function loginPartner(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string
): Promise<{ success: boolean; token?: string; error?: string; partner?: PartnerUser }> {
  // Find partner by contact email
  const partner = await prisma.partner.findFirst({
    where: { contactEmail: email.toLowerCase() },
  });

  if (!partner) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if partner is approved
  if (partner.status !== 'ACTIVE') {
    return { success: false, error: 'Your account is not yet approved. Please contact support.' };
  }

  // Check password
  const settings = partner.settings as any;
  if (!settings?.passwordHash) {
    return { success: false, error: 'Account not set up. Please contact support.' };
  }

  const isValid = await bcrypt.compare(password, settings.passwordHash);

  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  const token = await createPartnerSession(partner.id, ipAddress, userAgent);

  return {
    success: true,
    token,
    partner: {
      id: partner.id,
      partnerId: partner.id,
      email: partner.contactEmail || '',
      name: partner.contactName || '',
      partnerName: partner.name,
      partnerSlug: partner.slug,
      partnerStatus: partner.status,
    },
  };
}

export async function logoutPartner(partnerId: string): Promise<void> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (partner) {
    const settings = (partner.settings as any) || {};
    delete settings.sessionToken;
    delete settings.sessionExpires;

    await prisma.partner.update({
      where: { id: partnerId },
      data: { settings },
    });
  }
}

export async function setPartnerPassword(partnerId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  const settings = (partner?.settings as any) || {};
  settings.passwordHash = passwordHash;

  await prisma.partner.update({
    where: { id: partnerId },
    data: { settings },
  });
}

export async function verifyPartnerPassword(partnerId: string, password: string): Promise<boolean> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (!partner) return false;

  const settings = partner.settings as any;
  if (!settings?.passwordHash) return false;

  return bcrypt.compare(password, settings.passwordHash);
}
