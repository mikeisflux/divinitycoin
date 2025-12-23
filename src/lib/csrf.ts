// lib/csrf.ts
// SECURITY: CSRF protection for state-changing endpoints

import crypto from 'crypto';
import { cookies } from 'next/headers';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CSRFToken {
  token: string;
  createdAt: number;
}

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token with timestamp
 */
export function createSignedToken(): string {
  const token = generateCSRFToken();
  const timestamp = Date.now();
  const data = `${token}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'csrf-secret-key')
    .update(data)
    .digest('hex');
  return `${data}:${signature}`;
}

/**
 * Verify a signed CSRF token
 */
export function verifySignedToken(signedToken: string): boolean {
  if (!signedToken) return false;

  const parts = signedToken.split(':');
  if (parts.length !== 3) return false;

  const [token, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  // Check if token has expired
  if (Date.now() - timestamp > TOKEN_EXPIRY_MS) {
    return false;
  }

  // Verify signature
  const data = `${token}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'csrf-secret-key')
    .update(data)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Set CSRF cookie in the response
 */
export async function setCSRFCookie(): Promise<string> {
  const signedToken = createSignedToken();
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_MS / 1000,
  });

  return signedToken;
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Validate CSRF token from request
 * Compares header token with cookie token using double-submit pattern
 */
export async function validateCSRFToken(
  headerToken: string | null,
  cookieToken?: string | null
): Promise<boolean> {
  // Get cookie token if not provided
  if (cookieToken === undefined) {
    cookieToken = await getCSRFFromCookie();
  }

  if (!headerToken || !cookieToken) {
    return false;
  }

  // Both tokens must be valid
  if (!verifySignedToken(headerToken) || !verifySignedToken(cookieToken)) {
    return false;
  }

  // Extract the actual token part (before timestamp) and compare
  const headerParts = headerToken.split(':');
  const cookieParts = cookieToken.split(':');

  if (headerParts.length !== 3 || cookieParts.length !== 3) {
    return false;
  }

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(headerParts[0]),
      Buffer.from(cookieParts[0])
    );
  } catch {
    return false;
  }
}

/**
 * Middleware helper to validate CSRF for state-changing requests
 * Returns error response if validation fails, null if valid
 */
export async function validateCSRFRequest(request: Request): Promise<Response | null> {
  const method = request.method.toUpperCase();

  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  // Skip CSRF for API key authenticated requests (they have their own auth)
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return null;
  }

  // Skip for webhook endpoints (they use signature verification)
  const url = new URL(request.url);
  if (url.pathname.includes('/webhook')) {
    return null;
  }

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const isValid = await validateCSRFToken(headerToken);

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing CSRF token' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

/**
 * Get CSRF token for client-side use
 * This should be called from a server component or API route to provide the token to the client
 */
export async function getCSRFTokenForClient(): Promise<string> {
  let token = await getCSRFFromCookie();

  if (!token || !verifySignedToken(token)) {
    token = await setCSRFCookie();
  }

  return token;
}

export const CSRF_HEADER = CSRF_HEADER_NAME;
