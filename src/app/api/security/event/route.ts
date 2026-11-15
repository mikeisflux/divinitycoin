// app/api/security/event/route.ts
// Internal sink for security events raised by the edge middleware, which
// cannot reach the database itself. Same shared-secret pattern as
// /api/botblock/report. Two event types today:
//
// - IOC_HIT: a request from an address in the FBI ARTEX FLASH. Recorded as
//   critical, emailed to the admin notification address (at most once per
//   address per hour), and — only when IOC_BLOCK_MODE=block — the address is
//   handed to blockIP. Default is log: the FBI asks that these be
//   corroborated before blocking, since cloud addresses get reassigned.
// - ADMIN_ALLOWLIST_DENIED: a request to /admin from outside
//   ADMIN_IP_ALLOWLIST. Recorded as warn; no block, since the most likely
//   cause is the owner on an unfamiliar network.

import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent, type SecurityEventType } from '@/lib/security/events';
import { blockIP } from '@/lib/botblock';
import { getConfig } from '@/lib/config';
import { queueEmail } from '@/lib/email/queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INTERNAL_SECRET = process.env.INTERNAL_API_KEY;
const ACCEPTED: ReadonlySet<SecurityEventType> = new Set(['IOC_HIT', 'ADMIN_ALLOWLIST_DENIED']);

// One alert email per address per hour. In-memory is fine: pm2 runs a
// single fork, and a restart at worst sends one extra email.
const lastAlertedAt = new Map<string, number>();
const ALERT_INTERVAL_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!INTERNAL_SECRET) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== INTERNAL_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { type?: string; ip?: string; path?: string; userAgent?: string; details?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const type = body.type as SecurityEventType;
  if (!ACCEPTED.has(type)) return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
  const ip = typeof body.ip === 'string' ? body.ip.slice(0, 45) : '';
  if (!ip) return NextResponse.json({ error: 'ip is required' }, { status: 400 });

  const severity = type === 'IOC_HIT' ? 'critical' : 'warn';
  await logSecurityEvent({
    type,
    severity,
    realm: type === 'IOC_HIT' ? 'api' : 'admin',
    ipAddress: ip,
    userAgent: body.userAgent ?? null,
    details: { path: body.path, ...(body.details ?? {}) },
  });

  if (type !== 'IOC_HIT') return NextResponse.json({ recorded: true });

  const mode = await getConfig('IOC_BLOCK_MODE', process.env.IOC_BLOCK_MODE || 'log');
  let blocked = false;
  if (mode === 'block') {
    await blockIP(ip, {
      reason: `ioc: ${String(body.details?.context ?? 'FBI FLASH-20261113-001')}`,
      userAgent: body.userAgent,
      path: body.path,
    }).catch((error) => logger.error('IOC block failed', { ip, error }));
    blocked = true;
  }

  const last = lastAlertedAt.get(ip) ?? 0;
  if (Date.now() - last > ALERT_INTERVAL_MS) {
    lastAlertedAt.set(ip, Date.now());
    const to = await getConfig('ADMIN_NOTIFICATION_EMAIL', 'admin@divinitycoin.com');
    const base = await getConfig('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_BASE_URL || 'https://divinitycoin.com');
    await queueEmail({
      to,
      subject: `[DivinityCoin security] Request from FBI-listed address ${ip}${blocked ? ' (blocked)' : ''}`,
      html: `
        <p>A request reached divinitycoin.com from <strong>${ip}</strong>, an address listed in
        FBI FLASH-20261113-001 (ARTEX autonomous attack framework).</p>
        <p><strong>Context:</strong> ${String(body.details?.context ?? '')}<br/>
        <strong>Path:</strong> ${String(body.path ?? '')}<br/>
        <strong>User agent:</strong> ${String(body.userAgent ?? '')}<br/>
        <strong>Action taken:</strong> ${blocked ? 'blocked at the firewall (IOC_BLOCK_MODE=block)' : 'logged only (IOC_BLOCK_MODE=log)'}</p>
        <p>The FBI notes these addresses are historical and may be reassigned; corroborate against
        the security log before acting. <a href="${base}/admin/logs/security">Open the security log</a>.</p>`,
      text: `Request from FBI-listed address ${ip} (${String(body.details?.context ?? '')}) to ${String(body.path ?? '')}. ${blocked ? 'Blocked.' : 'Logged only.'} See ${base}/admin/logs/security`,
      priority: 1,
    }).catch((error) => logger.error('IOC alert email failed', { ip, error }));
  }

  return NextResponse.json({ recorded: true, blocked });
}
