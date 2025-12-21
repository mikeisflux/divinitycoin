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

  // Store in partner's session (we'll use a simple approach - store in partner metadata)
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      settings: {
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
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('partner_session')?.value;

  if (!sessionToken) return null;

  return validatePartnerSession(sessionToken);
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
