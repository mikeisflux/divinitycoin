// lib/security/events.ts
// Best-effort writer for the SecurityEvent stream. Never throws and never
// awaits anything the caller's response depends on: a logging failure must
// not turn into a login failure.

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOCKOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'RATE_LIMITED'
  | 'PARTNER_API_AUTH_FAILED'
  | 'PARTNER_API_RATE_LIMITED'
  | 'PARTNER_API_WRONG_PATH'
  | 'IOC_HIT'
  | 'VOLUME_ANOMALY'
  | 'MFA_ENROLLED'
  | 'MFA_DISABLED'
  | 'MFA_FAILED'
  | 'MFA_RECOVERY_USED';

export type SecurityRealm = 'admin' | 'partner' | 'customer' | 'api';
export type SecuritySeverity = 'info' | 'warn' | 'critical';

export interface SecurityEventInput {
  type: SecurityEventType;
  severity?: SecuritySeverity;
  realm?: SecurityRealm;
  subject?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

/** Fire-and-forget. Safe to call without awaiting. */
export function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  return prisma.securityEvent
    .create({
      data: {
        type: input.type,
        severity: input.severity ?? 'info',
        realm: input.realm ?? null,
        subject: input.subject ?? null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
        details: input.details ? (input.details as object) : undefined,
      },
    })
    .then(() => undefined)
    .catch((error) => {
      logger.error('Failed to write SecurityEvent', { type: input.type, error });
    });
}

/** Client IP from the headers nginx sets; empty string when unknown. */
export function ipFromHeaders(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    ''
  );
}
