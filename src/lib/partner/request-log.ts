// lib/partner/request-log.ts
// Records every inbound partner API request to ApiRequestLog.
//
// Until this existed, ApiRequestLog held only our *outbound* webhook
// deliveries. Nothing recorded who called /internal, with which key, from
// where, or how often — so when a partner asked which call had created a
// charge, the answer was "no idea", and reviewing the partner API for
// abuse over any period was impossible. The FBI's ARTEX FLASH names partner
// portals as the first thing autonomous attack frameworks go after; a
// portal with no request log is one you cannot investigate.

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const BODY_EXCERPT_CHARS = 1000;

// Keys whose values never belong in a log, whatever the casing.
const REDACT_KEYS = /^(password|passwordhash|token|secret|apikey|api_key|authorization|code|cvc|cvv|number|cardnumber|card_number|client_secret|clientsecret|ssn)$/i;

/** Deep-redact sensitive keys, then stringify and truncate. */
export function redactForLog(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw.slice(0, BODY_EXCERPT_CHARS);
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = REDACT_KEYS.test(k) ? '[redacted]' : walk(val);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(parsed)).slice(0, BODY_EXCERPT_CHARS);
}

export interface InternalRequestRecord {
  partnerId: string | null;
  apiKeyId: string | null;
  method: string;
  action: string | null;
  path: string;
  ipAddress: string;
  userAgent: string | null;
  statusCode: number;
  responseTimeMs: number;
  requestBody: string | null;
  responseBody: string | null;
  errorMessage?: string | null;
}

/** Fire-and-forget. */
export function recordInternalRequest(r: InternalRequestRecord): Promise<void> {
  return prisma.apiRequestLog
    .create({
      data: {
        partnerId: r.partnerId,
        apiKeyId: r.apiKeyId,
        method: r.method,
        endpoint: r.action ? `/internal?action=${r.action}` : '/internal',
        path: r.path.slice(0, 512),
        ipAddress: r.ipAddress || 'unknown',
        userAgent: r.userAgent ? r.userAgent.slice(0, 512) : null,
        statusCode: r.statusCode,
        responseTimeMs: r.responseTimeMs,
        requestBody: redactForLog(r.requestBody),
        responseBody: redactForLog(r.responseBody),
        errorMessage: r.errorMessage ?? null,
      },
    })
    .then(() => undefined)
    .catch((error) => {
      logger.error('Failed to record partner API request', { action: r.action, error });
    });
}
