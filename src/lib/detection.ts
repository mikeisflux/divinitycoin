// lib/detection.ts
// Edge-runtime-safe in-memory sliding-window counters for request rate
// and "suspicious signal" events. Middleware uses these to decide when to
// return 429 or fire-and-forget a firewall block via /api/botblock/report.
//
// No fs, no Prisma, no Node-only APIs — this module must stay safe to
// import from middleware.ts.

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;
const MAX_MAP_SIZE = 50_000;

const requestBuckets = new Map<string, Bucket>();
const suspiciousBuckets = new Map<string, Bucket>();
const reportedIPs = new Map<string, number>(); // ip -> reportedAt timestamp
const REPORT_COOLDOWN_MS = 60 * 60 * 1000;

// Per-minute thresholds
export const SOFT_LIMIT = 300;        // return 429 to the caller
export const HARD_LIMIT = 600;        // firewall block (iptables)
export const SUSPICIOUS_LIMIT = 3;    // firewall block after N bad signals

// IPs that can never be rate-limited or firewalled.
const WHITELIST = new Set<string>([
  '127.0.0.1',
  '::1',
  '178.156.177.56', // partner server
]);

function bump(map: Map<string, Bucket>, ip: string): number {
  const now = Date.now();
  let bucket = map.get(ip);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    map.set(ip, bucket);
  }
  bucket.count++;

  if (map.size > MAX_MAP_SIZE) {
    const cutoff = now - WINDOW_MS * 2;
    for (const [k, v] of map) {
      if (v.windowStart < cutoff) map.delete(k);
    }
  }
  return bucket.count;
}

export function isWhitelisted(ip: string | undefined | null): boolean {
  if (!ip) return true;
  return WHITELIST.has(ip);
}

export function recordRequest(ip: string): number {
  if (isWhitelisted(ip)) return 0;
  return bump(requestBuckets, ip);
}

export function recordSuspicious(ip: string): number {
  if (isWhitelisted(ip)) return 0;
  return bump(suspiciousBuckets, ip);
}

/**
 * Dedupe block reports per IP within REPORT_COOLDOWN_MS. Returns true if
 * this IP should be reported now, false if it was recently reported.
 */
export function shouldReportBlock(ip: string): boolean {
  if (isWhitelisted(ip)) return false;
  const now = Date.now();
  const last = reportedIPs.get(ip);
  if (last && now - last < REPORT_COOLDOWN_MS) return false;
  reportedIPs.set(ip, now);

  if (reportedIPs.size > MAX_MAP_SIZE) {
    const cutoff = now - REPORT_COOLDOWN_MS;
    for (const [k, v] of reportedIPs) {
      if (v < cutoff) reportedIPs.delete(k);
    }
  }
  return true;
}
