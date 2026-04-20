// middleware.ts
// Next.js middleware for security headers, CORS, and bot/rate detection.

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

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '';
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return request.ip || '';
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const host = request.headers.get('host') || '';
  const ip = getClientIp(request);

  // ---- Rate limit / abuse detection ----
  const rateLimitable = !RATE_LIMIT_EXEMPT_PREFIXES.some(p => pathname.startsWith(p));
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
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

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
