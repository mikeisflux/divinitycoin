// middleware.ts
// Next.js middleware for security headers and CORS

import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins for CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_BASE_URL,
  'https://divinitycoin.com',
  'https://www.divinitycoin.com',
].filter(Boolean);

// VPN subnet for internal API (WireGuard)
const VPN_SUBNET = '10.10.0.';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') || '';

  // Block /internal routes from public access (only allow VPN)
  if (pathname.startsWith('/internal') || pathname.startsWith('/api/internal')) {
    if (!clientIP.startsWith(VPN_SUBNET)) {
      return new NextResponse(null, { status: 404 });
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
    // Allow requests from allowed origins
    if (allowedOrigins.includes(origin) || !origin) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
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
