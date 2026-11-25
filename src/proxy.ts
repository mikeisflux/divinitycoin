// proxy.ts
// Next.js proxy (formerly the `middleware` file convention, renamed in
// Next.js 16) for security headers, CORS, and bot/rate detection.

import { NextRequest, NextResponse } from 'next/server';
import {
  recordRequest,
  recordSuspicious,
  shouldReportBlock,
  isWhitelisted,
  SOFT_LIMIT,
  HARD_LIMIT,
  SUSPICIOUS_LIMIT,
} from '@/lib/detection';
import { matchIoc } from '@/lib/security/iocs';

// Define allowed origins for CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://divinitycoin.com',
  'https://www.divinitycoin.com',
].filter(Boolean);

// Paths that should NOT count toward rate limits — legitimate high-frequency
// callers. (Health checks, external webhooks, partner API.)
const RATE_LIMIT_EXEMPT_PREFIXES = [
  '/api/health',
  '/api/webhook/',
  '/api/webhooks/',
  '/webhook/',
  '/internal',
];

/**
 * Documentation and integration surfaces that must never escalate to a block.
 *
 * A suspicion flag here does not just return a 4xx — after SUSPICIOUS_LIMIT
 * signals it reports the IP to BotBlock, which installs an iptables DROP.
 * That is a kernel-level ban on the developer's whole office, applied while
 * they were reading our API documentation or retrying a wrong URL, and
 * nothing in the resulting silence tells them why.
 *
 * Reading the docs is not an attack. These paths are exempt from rate limiting
 * and can never raise a suspicion signal. Every other protection — security
 * headers, CORS, the sensitive-path 404 — still applies to them, and every
 * other path is unaffected.
 */
const NEVER_FLAG_PREFIXES = [
  '/developers',
  '/partners/documentation',
  '/partners/login',
  '/partners/setup',
  '/become-a-partner',
  '/api/internal',
];

// ---- Hosted checkout embed allowlist (edge cache) ----
const FRAME_ANCESTORS_TTL_MS = 60 * 1000;
let frameAncestorsCache: { origins: string[]; fetchedAt: number } | null = null;

function envFrameAncestors(): string[] {
  return (process.env.CHECKOUT_FRAME_ANCESTORS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getFrameAncestorOrigins(request: NextRequest): Promise<string[]> {
  const now = Date.now();
  if (frameAncestorsCache && now - frameAncestorsCache.fetchedAt < FRAME_ANCESTORS_TTL_MS) {
    return frameAncestorsCache.origins;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const res = await fetch(`${origin}/api/checkout/frame-ancestors`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { origins?: unknown };
      const origins = Array.isArray(data.origins) ? data.origins.filter((o): o is string => typeof o === 'string') : [];
      frameAncestorsCache = { origins, fetchedAt: now };
      return origins;
    }
  } catch {
    // fall through to whatever we last knew
  }
  if (frameAncestorsCache) return frameAncestorsCache.origins;
  return envFrameAncestors();
}

/** ADMIN_IP_ALLOWLIST: comma/space-separated IPv4 addresses or CIDRs. */
const ADMIN_ALLOWLIST: Array<{ base: number; mask: number }> = (process.env.ADMIN_IP_ALLOWLIST || '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map(parseCidr)
  .filter((c): c is { base: number; mask: number } => c !== null);

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function parseCidr(entry: string): { base: number; mask: number } | null {
  const [ipPart, bitsPart] = entry.split('/');
  const ip = ipv4ToInt(ipPart);
  if (ip === null) return null;
  const bits = bitsPart === undefined ? 32 : Number(bitsPart);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: (ip & mask) >>> 0, mask };
}

function ipAllowed(ip: string, list: Array<{ base: number; mask: number }>): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return list.some((c) => ((n & c.mask) >>> 0) === c.base);
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '';
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  // NextRequest.ip no longer exists; behind nginx the headers above are
  // authoritative anyway, and an empty string is the existing no-IP signal.
  return '';
}

/**
 * Fire-and-forget security event from the edge, where there is no database.
 * /api/security/event records it and decides on any further action.
 */
function reportSecurityEvent(
  request: NextRequest,
  type: 'IOC_HIT' | 'ADMIN_ALLOWLIST_DENIED',
  ip: string,
  details: Record<string, unknown>,
): void {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return;
  const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  fetch(`${origin}/api/security/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      type,
      ip,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') || undefined,
      details,
    }),
  }).catch(() => { /* best-effort */ });
}

/**
 * Fire-and-forget request to /api/botblock/report so the middleware doesn't
 * wait for the firewall/DB roundtrip. Runs only when an IP is clearly abusive.
 */
function reportToFirewall(
  request: NextRequest,
  ip: string,
  reason: string,
): void {
  if (!shouldReportBlock(ip)) return;
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return;

  const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  // Don't await — let this happen in the background.
  fetch(`${origin}/api/botblock/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      ip,
      reason,
      userAgent: request.headers.get('user-agent') || undefined,
      path: request.nextUrl.pathname,
    }),
  }).catch(() => {
    // Swallow — report is best-effort. Process rotation or network hiccup
    // shouldn't impact the user-facing response.
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const host = request.headers.get('host') || '';
  const ip = getClientIp(request);

  // ---- FBI FLASH-20261113-001 indicators ----
  // A hit is always recorded and alerted; it is refused only when
  // IOC_BLOCK_MODE=block has been set deliberately (see lib/security/iocs.ts
  // for why the default is to log).
  const ioc = matchIoc(ip);
  if (ioc) {
    reportSecurityEvent(request, 'IOC_HIT', ip, { indicator: ioc.indicator, context: ioc.context });
    if (process.env.IOC_BLOCK_MODE === 'block') {
      return new NextResponse(null, { status: 403 });
    }
  }

  const isDocsSurface = NEVER_FLAG_PREFIXES.some(p => pathname.startsWith(p));

  // ---- Admin interface allowlist (opt-in) ----
  // The host firewall already restricts SSH to known addresses; this is the
  // same control for /admin, which shares port 443 with the public site and
  // so cannot be firewalled on its own. Empty (the default) means off.
  // Anything outside the list gets the same 404 a non-existent path would,
  // and the attempt is recorded. Mind dynamic home IPs and CGNAT before
  // turning this on; see docs/SERVER-HARDENING.md for the recovery path.
  if (ADMIN_ALLOWLIST.length > 0 && (pathname.startsWith('/admin') || pathname.startsWith('/api/admin'))) {
    if (!ipAllowed(ip, ADMIN_ALLOWLIST)) {
      reportSecurityEvent(request, 'ADMIN_ALLOWLIST_DENIED', ip, {});
      return new NextResponse(null, { status: 404 });
    }
  }

  // ---- Rate limit / abuse detection ----
  const rateLimitable =
    !isDocsSurface && !RATE_LIMIT_EXEMPT_PREFIXES.some(p => pathname.startsWith(p));
  if (rateLimitable && !isWhitelisted(ip)) {
    const count = recordRequest(ip);
    if (count >= HARD_LIMIT) {
      reportToFirewall(request, ip, `rate_abuse: ${count} req/min`);
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '300' },
      });
    }
    if (count >= SOFT_LIMIT) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }

  // Helper: record a suspicious signal and escalate to firewall if the IP
  // has accumulated enough bad requests in the sliding window.
  const flagSuspicious = (reason: string) => {
    if (isWhitelisted(ip)) return;
    // Never let a documentation or onboarding path put someone in the firewall.
    if (isDocsSurface) return;
    const hits = recordSuspicious(ip);
    if (hits >= SUSPICIOUS_LIMIT) {
      reportToFirewall(request, ip, `suspicious: ${reason} (${hits} hits)`);
    }
  };

  // Block bot attacks on server actions
  // These are malformed requests from scanners/bots that cause Next.js errors
  const nextAction = request.headers.get('next-action');
  if (nextAction) {
    // Valid Next.js server action IDs are long hashes (40 chars), not single characters like "x"
    // Block obviously invalid action IDs (less than 10 chars or containing only simple chars)
    if (nextAction.length < 10 || /^[a-z0-9]{1,5}$/i.test(nextAction)) {
      flagSuspicious('invalid_next_action_id');
      return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For server actions, ensure we have a valid origin
    // This prevents "Missing origin header" errors in logs
    if (!origin) {
      // Verify host is one of our known hosts
      const knownHosts = ['divinitycoin.com', 'www.divinitycoin.com', 'localhost:3000'];
      const isKnownHost = knownHosts.some(h => host.includes(h));

      if (!isKnownHost) {
        // Unknown host with server action and no origin - likely a bot
        flagSuspicious('server_action_unknown_host');
        return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Block POST requests to non-API paths without origin (bot attacks on server actions)
  if (request.method === 'POST' && !origin && !pathname.startsWith('/api/')) {
    // Webhooks and internal partner API are exempt - they legitimately don't have origin headers
    // (server-to-server calls don't include Origin)
    if (!pathname.startsWith('/webhook/') && !pathname.startsWith('/internal')) {
      const contentType = request.headers.get('content-type') || '';
      // If it's a POST without origin, it's likely a bot
      // Only allow multipart form data for file uploads
      if (!contentType.includes('multipart/form-data')) {
        flagSuspicious('post_no_origin');
        return new NextResponse(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Create response with pathname header for layout detection
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers to all responses
  const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  // Frame embedding policy. Default-deny for everything via
  // X-Frame-Options: DENY. The DC-hosted checkout (/checkout/*) is the
  // one exception — partners may mount it inside their own page. The
  // allowed origins are managed at /admin/settings/checkout-embedding
  // (SystemConfig CHECKOUT_FRAME_ANCESTORS; the environment variable of
  // the same name is the fallback). This runs at the edge, with no
  // database, so the resolved list is fetched from the app and cached
  // for a minute; a stale copy, then the environment, cover a failed
  // fetch. Empty = frame-ancestors 'none', which behaves like DENY. CSP
  // is used because X-Frame-Options cannot allowlist several origins.
  const isHostedCheckoutPath = pathname.startsWith('/checkout/');
  if (isHostedCheckoutPath) {
    const allowList = await getFrameAncestorOrigins(request);
    const sources = allowList.length > 0
      ? `'self' ${allowList.join(' ')}`
      : `'none'`;
    securityHeaders['Content-Security-Policy'] = `frame-ancestors ${sources}`;
  } else {
    securityHeaders['X-Frame-Options'] = 'DENY';
  }

  // Add HSTS header in production
  if (process.env.NODE_ENV === 'production') {
    securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    // SECURITY: Only allow requests from explicitly allowed origins
    // Do NOT allow empty origin or set wildcard - this prevents CORS bypass attacks
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Internal-Key, X-Webhook-Signature');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }
  }

  // Prevent sensitive data exposure in admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // Block access to sensitive paths
  const blockedPaths = [
    '/.env',
    '/.git',
    '/prisma',
    '/node_modules',
    '/.next',
    '/package.json',
    '/tsconfig.json',
  ];

  if (blockedPaths.some(blocked => pathname.startsWith(blocked))) {
    flagSuspicious(`probing_sensitive_path:${pathname}`);
    return new NextResponse(null, { status: 404 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
