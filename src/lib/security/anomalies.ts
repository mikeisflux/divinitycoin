// lib/security/anomalies.ts
// Volume-anomaly detection over the request and security-event streams.
//
// The FBI's ARTEX FLASH asks for alerts when an application "operates
// materially outside normal volume" and, on partner portals, for
// "sequential lookups and unusually high numbers of records accessed per
// session". Autonomous frameworks are noisy — hundreds of requests in
// minutes — but fast, so the detection window has to be short.
//
// Method: for each signal, count the last WINDOW minutes and compare with
// the average WINDOW-sized bucket over the previous BASELINE_DAYS. A finding
// needs both an absolute floor (so an idle site's first ten requests are not
// an "anomaly") and a multiple of the baseline. Findings are de-duplicated
// against VOLUME_ANOMALY events already raised for the same signal and
// subject in the last hour, so a sustained burst alerts once, not every run.

import { prisma } from '@/lib/db';

export const WINDOW_MINUTES = 15;
const BASELINE_DAYS = 7;
const BASELINE_BUCKETS = (BASELINE_DAYS * 24 * 60) / WINDOW_MINUTES;

export interface AnomalyFinding {
  signal: string;
  subject: string;
  current: number;
  baseline: number;
  threshold: number;
  note?: string;
}

interface Rule { floor: number; multiplier: number }

const RULES: Record<string, Rule> = {
  partner_api_calls: { floor: 300, multiplier: 4 },
  partner_api_4xx: { floor: 50, multiplier: 4 },
  partner_api_auth_failed: { floor: 10, multiplier: 1 },
  partner_api_wrong_path: { floor: 25, multiplier: 1 },
  login_failed: { floor: 15, multiplier: 4 },
  credential_stuffing: { floor: 5, multiplier: 1 },
  rate_limited: { floor: 1, multiplier: 1 },
  ioc_hit: { floor: 1, multiplier: 1 },
};

function breaches(signal: string, current: number, baseline: number): { hit: boolean; threshold: number } {
  const rule = RULES[signal];
  const threshold = Math.max(rule.floor, Math.ceil(baseline * rule.multiplier));
  return { hit: current >= threshold, threshold };
}

export async function detectAnomalies(now = new Date()): Promise<AnomalyFinding[]> {
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  const baselineStart = new Date(windowStart.getTime() - BASELINE_DAYS * 24 * 60 * 60_000);
  const findings: AnomalyFinding[] = [];

  // ── Partner API volume and error rate, per partner ──────────────────
  const [curCalls, baseCalls, cur4xx, base4xx] = await Promise.all([
    prisma.apiRequestLog.groupBy({ by: ['partnerId'], where: { endpoint: { startsWith: '/internal' }, timestamp: { gte: windowStart } }, _count: { _all: true } }),
    prisma.apiRequestLog.groupBy({ by: ['partnerId'], where: { endpoint: { startsWith: '/internal' }, timestamp: { gte: baselineStart, lt: windowStart } }, _count: { _all: true } }),
    prisma.apiRequestLog.groupBy({ by: ['partnerId'], where: { endpoint: { startsWith: '/internal' }, statusCode: { gte: 400, lt: 500 }, timestamp: { gte: windowStart } }, _count: { _all: true } }),
    prisma.apiRequestLog.groupBy({ by: ['partnerId'], where: { endpoint: { startsWith: '/internal' }, statusCode: { gte: 400, lt: 500 }, timestamp: { gte: baselineStart, lt: windowStart } }, _count: { _all: true } }),
  ]);
  const perBucket = (rows: { partnerId: string | null; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.partnerId ?? 'unauthenticated', r._count._all / BASELINE_BUCKETS]));
  const baseCallMap = perBucket(baseCalls);
  const base4xxMap = perBucket(base4xx);
  for (const r of curCalls) {
    const subject = r.partnerId ?? 'unauthenticated';
    const baseline = baseCallMap.get(subject) ?? 0;
    const { hit, threshold } = breaches('partner_api_calls', r._count._all, baseline);
    if (hit) findings.push({ signal: 'partner_api_calls', subject, current: r._count._all, baseline: round(baseline), threshold });
  }
  for (const r of cur4xx) {
    const subject = r.partnerId ?? 'unauthenticated';
    const baseline = base4xxMap.get(subject) ?? 0;
    const { hit, threshold } = breaches('partner_api_4xx', r._count._all, baseline);
    if (hit) findings.push({ signal: 'partner_api_4xx', subject, current: r._count._all, baseline: round(baseline), threshold, note: 'client errors from one partner — enumeration or a broken integration' });
  }

  // ── Security events in the window ───────────────────────────────────
  const events = await prisma.securityEvent.findMany({
    where: { createdAt: { gte: windowStart } },
    select: { type: true, realm: true, subject: true, ipAddress: true },
  });
  const count = (pred: (e: typeof events[number]) => boolean) => events.filter(pred).length;

  const authFailed = count((e) => e.type === 'PARTNER_API_AUTH_FAILED');
  if (authFailed) {
    const { hit, threshold } = breaches('partner_api_auth_failed', authFailed, 0);
    if (hit) findings.push({ signal: 'partner_api_auth_failed', subject: 'partner api', current: authFailed, baseline: 0, threshold, note: 'invalid API keys presented' });
  }
  const wrongPath = count((e) => e.type === 'PARTNER_API_WRONG_PATH');
  if (wrongPath) {
    const { hit, threshold } = breaches('partner_api_wrong_path', wrongPath, 0);
    if (hit) findings.push({ signal: 'partner_api_wrong_path', subject: '/api/internal', current: wrongPath, baseline: 0, threshold, note: 'path probing' });
  }
  for (const realm of ['admin', 'partner', 'customer'] as const) {
    const cur = count((e) => e.type === 'LOGIN_FAILED' && e.realm === realm);
    if (!cur) continue;
    const base = await prisma.securityEvent.count({ where: { type: 'LOGIN_FAILED', realm, createdAt: { gte: baselineStart, lt: windowStart } } });
    const baseline = base / BASELINE_BUCKETS;
    const { hit, threshold } = breaches('login_failed', cur, baseline);
    if (hit) findings.push({ signal: 'login_failed', subject: realm, current: cur, baseline: round(baseline), threshold });
  }
  // Credential stuffing: one address trying many different accounts.
  const byIp = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.type !== 'LOGIN_FAILED' || !e.ipAddress || !e.subject) continue;
    if (!byIp.has(e.ipAddress)) byIp.set(e.ipAddress, new Set());
    byIp.get(e.ipAddress)!.add(e.subject);
  }
  for (const [ip, subjects] of byIp) {
    const { hit, threshold } = breaches('credential_stuffing', subjects.size, 0);
    if (hit) findings.push({ signal: 'credential_stuffing', subject: ip, current: subjects.size, baseline: 0, threshold, note: 'distinct accounts attempted from one address' });
  }
  const limited = count((e) => e.type === 'RATE_LIMITED' || e.type === 'PARTNER_API_RATE_LIMITED');
  if (limited) findings.push({ signal: 'rate_limited', subject: 'all', current: limited, baseline: 0, threshold: 1 });
  const ioc = count((e) => e.type === 'IOC_HIT');
  if (ioc) findings.push({ signal: 'ioc_hit', subject: 'FBI FLASH-20261113-001', current: ioc, baseline: 0, threshold: 1, note: 'see individual IOC_HIT events' });

  return findings;
}

/** Drop findings already alerted for the same signal+subject in the last hour. */
export async function withoutRecentDuplicates(findings: AnomalyFinding[]): Promise<AnomalyFinding[]> {
  if (findings.length === 0) return findings;
  const since = new Date(Date.now() - 60 * 60_000);
  const recent = await prisma.securityEvent.findMany({
    where: { type: 'VOLUME_ANOMALY', createdAt: { gte: since } },
    select: { subject: true },
  });
  const seen = new Set(recent.map((r) => r.subject));
  return findings.filter((f) => !seen.has(`${f.signal}:${f.subject}`));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
