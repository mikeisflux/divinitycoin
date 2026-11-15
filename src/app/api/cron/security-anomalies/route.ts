// app/api/cron/security-anomalies/route.ts
// Runs the volume-anomaly detector and alerts on new findings.
//
// Call every 15 minutes:
//   curl -X POST https://divinitycoin.com/api/cron/security-anomalies?secret=...
//
// Each new finding is recorded as a VOLUME_ANOMALY security event (subject
// "<signal>:<subject>", which is also the de-duplication key) and the run's
// findings are emailed as one digest to ADMIN_NOTIFICATION_EMAIL.

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { queueEmail } from '@/lib/email/queue';
import { logSecurityEvent } from '@/lib/security/events';
import { detectAnomalies, withoutRecentDuplicates, WINDOW_MINUTES } from '@/lib/security/anomalies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authorizeCron(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = await getConfig('CRON_SECRET', '');
  if (!cronSecret) return null;
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('secret');
  const fromHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (fromQuery !== cronSecret && fromHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const unauth = await authorizeCron(request);
  if (unauth) return unauth;

  try {
    const all = await detectAnomalies();
    const fresh = await withoutRecentDuplicates(all);

    for (const f of fresh) {
      await logSecurityEvent({
        type: 'VOLUME_ANOMALY',
        severity: f.signal === 'ioc_hit' || f.signal === 'credential_stuffing' ? 'critical' : 'warn',
        realm: f.signal.startsWith('partner_api') ? 'api' : undefined,
        subject: `${f.signal}:${f.subject}`,
        details: { ...f, windowMinutes: WINDOW_MINUTES },
      });
    }

    if (fresh.length > 0) {
      const to = await getConfig('ADMIN_NOTIFICATION_EMAIL', 'admin@divinitycoin.com');
      const base = await getConfig('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_BASE_URL || 'https://divinitycoin.com');
      const rows = fresh
        .map((f) => `<tr><td>${f.signal}</td><td>${f.subject}</td><td align="right">${f.current}</td><td align="right">${f.baseline}</td><td align="right">${f.threshold}</td><td>${f.note ?? ''}</td></tr>`)
        .join('');
      await queueEmail({
        to,
        subject: `[DivinityCoin security] ${fresh.length} volume ${fresh.length === 1 ? 'anomaly' : 'anomalies'} in the last ${WINDOW_MINUTES} minutes`,
        html: `
          <p>The following signals are materially above their normal volume for the last ${WINDOW_MINUTES} minutes
          (baseline = average ${WINDOW_MINUTES}-minute bucket over the previous 7 days):</p>
          <table border="1" cellpadding="6" cellspacing="0">
            <tr><th>Signal</th><th>Subject</th><th>Now</th><th>Baseline</th><th>Threshold</th><th>Note</th></tr>${rows}
          </table>
          <p><a href="${base}/admin/logs/security">Open the security log</a>. Further findings for the same
          signal and subject are suppressed for one hour.</p>`,
        text: fresh.map((f) => `${f.signal} [${f.subject}] now=${f.current} baseline=${f.baseline} threshold=${f.threshold} ${f.note ?? ''}`).join('\n') + `\n\n${base}/admin/logs/security`,
        priority: 1,
      });
      logger.warn('Security volume anomalies detected', { count: fresh.length, findings: fresh });
    }

    return NextResponse.json({ success: true, windowMinutes: WINDOW_MINUTES, findings: all, alerted: fresh.length });
  } catch (error) {
    logger.error('Security anomaly run failed', { error });
    return NextResponse.json({ error: 'Anomaly detection failed' }, { status: 500 });
  }
}
