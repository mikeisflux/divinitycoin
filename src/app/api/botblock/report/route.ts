// app/api/botblock/report/route.ts
// Internal endpoint used by middleware to request a firewall block.
// Middleware runs on the Edge runtime and can't touch fs/Prisma, so it
// fire-and-forgets to this Node route, which calls blockIP() to persist
// to the DB and append to /tmp/botblock-pending.
//
// Protected by:
//   1. Shared-secret header (INTERNAL_API_KEY) — middleware knows it.
//   2. Loopback-only — refuses requests not coming from 127.0.0.1/::1.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { blockIP } from '@/lib/botblock';
import { logger } from '@/lib/logger';

const INTERNAL_SECRET = process.env.INTERNAL_API_KEY;

function isLoopback(request: NextRequest): boolean {
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const xri = request.headers.get('x-real-ip')?.trim();
  const remote = request.ip;
  const candidates = [xff, xri, remote].filter(Boolean);
  if (candidates.length === 0) return true; // no proxy = same-process fetch
  return candidates.every(ip => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
}

function authorized(request: NextRequest): boolean {
  if (!INTERNAL_SECRET) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token.length !== INTERNAL_SECRET.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(INTERNAL_SECRET));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isLoopback(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { ip?: string; reason?: string; userAgent?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ip, reason, userAgent, path } = body;
  if (!ip || !reason) {
    return NextResponse.json({ error: 'Missing ip or reason' }, { status: 400 });
  }

  try {
    await blockIP(ip, { reason, userAgent, path });
    logger.info('botblock: firewall block requested', { ip, reason, path });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('botblock: blockIP failed', { error, ip });
    return NextResponse.json({ error: 'Block failed' }, { status: 500 });
  }
}
