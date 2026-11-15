// lib/admin/mfa.ts
// TOTP second factor for admin accounts.
//
// Before this, AdminUser had mfaEnabled/mfaSecret columns and Settings had a
// "Require MFA for all admins" switch, and nothing read either: the switch
// enforced nothing and no login ever asked for a code. The FBI's ARTEX FLASH
// lists weak administrative credentials and account takeover as primary
// initial-access vectors for autonomous attack frameworks; an admin panel on
// the public internet needs a second factor that actually exists.
//
// Design:
//  - Secrets are encrypted at rest with ENCRYPTION_SECRET (lib/encryption).
//  - Enrolment is two-step: a pending secret is issued and only becomes
//    live once the admin proves their app generates the right code.
//  - A used TOTP step is remembered, so the same code cannot be replayed
//    inside its validity window.
//  - Eight single-use recovery codes, stored hashed, shown exactly once.
//  - Sign-in with MFA pending is a short-lived AdminMfaChallenge in an
//    httpOnly cookie; five wrong codes delete it.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { logSecurityEvent } from '@/lib/security/events';
import { logAdminAction, validateAdminSession, type AdminUser } from '@/lib/admin/auth';

export const MFA_CHALLENGE_COOKIE = 'admin_mfa_challenge';
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const MAX_CHALLENGE_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 8;
const ISSUER = 'DivinityCoin Admin';
// One 30-second step either side, for clock drift between phone and server.
const EPOCH_TOLERANCE_SECONDS = 30;

type Ctx = { ipAddress: string; userAgent: string };

// ── Challenges ─────────────────────────────────────────────────────────

export async function createMfaChallenge(
  adminId: string,
  purpose: 'login' | 'enroll',
  ctx: Ctx,
): Promise<string> {
  // One live challenge per admin: a new sign-in invalidates the last.
  await prisma.adminMfaChallenge.deleteMany({ where: { adminId } });
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.adminMfaChallenge.create({
    data: {
      adminId,
      token,
      purpose,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent.slice(0, 512),
      expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_SECONDS * 1000),
    },
  });
  return token;
}

export interface ChallengeRecord {
  id: string;
  purpose: string;
  attempts: number;
  admin: { id: string; email: string; name: string; role: string; mfaEnabled: boolean };
}

export async function getMfaChallenge(token: string | undefined | null): Promise<ChallengeRecord | null> {
  if (!token) return null;
  const c = await prisma.adminMfaChallenge.findUnique({
    where: { token },
    include: { admin: { select: { id: true, email: true, name: true, role: true, mfaEnabled: true } } },
  });
  if (!c) return null;
  if (c.expiresAt < new Date()) {
    await prisma.adminMfaChallenge.delete({ where: { id: c.id } }).catch(() => undefined);
    return null;
  }
  return { id: c.id, purpose: c.purpose, attempts: c.attempts, admin: c.admin };
}

/** Count a failed code against the challenge. Returns false once it is spent. */
export async function recordChallengeFailure(challengeId: string): Promise<boolean> {
  const c = await prisma.adminMfaChallenge.update({
    where: { id: challengeId },
    data: { attempts: { increment: 1 } },
  });
  if (c.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    await prisma.adminMfaChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
    return false;
  }
  return true;
}

export async function consumeMfaChallenge(challengeId: string): Promise<void> {
  await prisma.adminMfaChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
}

/**
 * Who is asking? Either an admin with a full session, or one mid-sign-in
 * holding a challenge cookie. Enrolment accepts both; everything else
 * needs the session.
 */
export async function resolveMfaPrincipal(): Promise<
  | { via: 'session'; admin: AdminUser }
  | { via: 'challenge'; admin: ChallengeRecord['admin']; challenge: ChallengeRecord }
  | null
> {
  const store = await cookies();
  const sessionToken = store.get('admin_session')?.value;
  if (sessionToken) {
    const admin = await validateAdminSession(sessionToken);
    if (admin) return { via: 'session', admin };
  }
  const challenge = await getMfaChallenge(store.get(MFA_CHALLENGE_COOKIE)?.value);
  if (challenge) return { via: 'challenge', admin: challenge.admin, challenge };
  return null;
}

// ── Enrolment ──────────────────────────────────────────────────────────

export async function beginEnrollment(admin: { id: string; email: string }): Promise<{
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: ISSUER, label: admin.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { mfaPendingSecret: encrypt(secret) },
  });
  return { secret, otpauthUrl, qrDataUrl };
}

export async function confirmEnrollment(
  adminId: string,
  code: string,
  ctx: Ctx,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin?.mfaPendingSecret) return { ok: false, error: 'No enrolment in progress' };
  const secret = decrypt(admin.mfaPendingSecret);
  const result = verifyTotp(secret, code);
  if (!result.valid) {
    void logSecurityEvent({ type: 'MFA_FAILED', severity: 'warn', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { stage: 'enrol' } });
    return { ok: false, error: 'That code is not correct. Check the time on your phone and try again.' };
  }
  const { plain, hashed } = generateRecoveryCodes();
  await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      mfaSecret: admin.mfaPendingSecret,
      mfaPendingSecret: null,
      mfaEnabled: true,
      mfaEnrolledAt: new Date(),
      mfaRecoveryCodes: hashed,
      mfaLastTimeStep: result.timeStep ?? null,
    },
  });
  void logSecurityEvent({ type: 'MFA_ENROLLED', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
  await logAdminAction(adminId, 'MFA_ENABLED', 'auth', adminId, { method: 'totp' }, ctx.ipAddress, ctx.userAgent);
  return { ok: true, recoveryCodes: plain };
}

// ── Verification ───────────────────────────────────────────────────────

export async function verifyMfaCode(
  adminId: string,
  code: string,
  ctx: Ctx,
): Promise<{ ok: true; method: 'totp' | 'recovery'; recoveryCodesRemaining?: number } | { ok: false; error: string }> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin?.mfaEnabled || !admin.mfaSecret) return { ok: false, error: 'MFA is not enabled on this account' };

  const trimmed = code.replace(/\s+/g, '');
  if (/^\d{6}$/.test(trimmed)) {
    const result = verifyTotp(decrypt(admin.mfaSecret), trimmed);
    if (result.valid) {
      // A code is good for its step and one either side; refuse one that was
      // already used so a shoulder-surfed or intercepted code dies with its
      // first use.
      if (result.timeStep !== undefined && admin.mfaLastTimeStep !== null && result.timeStep <= admin.mfaLastTimeStep) {
        void logSecurityEvent({ type: 'MFA_FAILED', severity: 'critical', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { reason: 'replay' } });
        return { ok: false, error: 'That code has already been used. Wait for the next one.' };
      }
      await prisma.adminUser.update({ where: { id: adminId }, data: { mfaLastTimeStep: result.timeStep ?? admin.mfaLastTimeStep } });
      return { ok: true, method: 'totp' };
    }
  }

  // Recovery code: XXXXX-XXXXX, single use.
  const normalised = trimmed.toUpperCase();
  const hash = hashRecoveryCode(normalised);
  if (admin.mfaRecoveryCodes.includes(hash)) {
    const remaining = admin.mfaRecoveryCodes.filter((h) => h !== hash);
    await prisma.adminUser.update({ where: { id: adminId }, data: { mfaRecoveryCodes: remaining } });
    void logSecurityEvent({ type: 'MFA_RECOVERY_USED', severity: 'warn', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { remaining: remaining.length } });
    await logAdminAction(adminId, 'MFA_RECOVERY_CODE_USED', 'auth', adminId, { remaining: remaining.length }, ctx.ipAddress, ctx.userAgent);
    return { ok: true, method: 'recovery', recoveryCodesRemaining: remaining.length };
  }

  void logSecurityEvent({ type: 'MFA_FAILED', severity: 'warn', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, details: { stage: 'verify' } });
  return { ok: false, error: 'Invalid code' };
}

export async function disableMfa(adminId: string, code: string, ctx: Ctx): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await verifyMfaCode(adminId, code, ctx);
  if (!check.ok) return check;
  const admin = await prisma.adminUser.update({
    where: { id: adminId },
    data: { mfaEnabled: false, mfaSecret: null, mfaPendingSecret: null, mfaRecoveryCodes: [], mfaEnrolledAt: null, mfaLastTimeStep: null },
    select: { email: true },
  });
  void logSecurityEvent({ type: 'MFA_DISABLED', severity: 'warn', realm: 'admin', subject: admin.email, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
  await logAdminAction(adminId, 'MFA_DISABLED', 'auth', adminId, {}, ctx.ipAddress, ctx.userAgent);
  return { ok: true };
}

export async function mfaStatus(adminId: string): Promise<{
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
  pendingEnrollment: boolean;
}> {
  const a = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { mfaEnabled: true, mfaEnrolledAt: true, mfaRecoveryCodes: true, mfaPendingSecret: true },
  });
  return {
    enabled: !!a?.mfaEnabled,
    enrolledAt: a?.mfaEnrolledAt?.toISOString() ?? null,
    recoveryCodesRemaining: a?.mfaRecoveryCodes.length ?? 0,
    pendingEnrollment: !!a?.mfaPendingSecret,
  };
}

// ── Primitives ─────────────────────────────────────────────────────────

function verifyTotp(secret: string, token: string): { valid: boolean; timeStep?: number } {
  try {
    const r = verifySync({ token, secret, epochTolerance: EPOCH_TOLERANCE_SECONDS }) as { valid: boolean; timeStep?: number };
    return { valid: !!r.valid, timeStep: r.timeStep };
  } catch (error) {
    logger.warn('TOTP verification threw', { error });
    return { valid: false };
  }
}

function generateRecoveryCodes(): { plain: string[]; hashed: string[] } {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const plain: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(10);
    let code = '';
    for (let j = 0; j < 10; j++) code += alphabet[bytes[j] % alphabet.length];
    plain.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return { plain, hashed: plain.map(hashRecoveryCode) };
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}
