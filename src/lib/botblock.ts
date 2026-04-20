// lib/botblock.ts
// App-side helper for the BotBlock firewall (see scripts/botblock/).
//
// Call `blockIP()` when detection logic (rate-limit abuse, failed captcha,
// invalid server-action hashes, etc.) identifies a bad actor. This records
// the block in the database and appends the IP to /tmp/botblock-pending so
// the root-privileged watcher can install an iptables DROP rule within ~5s.
//
// `recordSuspicious()` logs suspicious behavior without blocking, for later
// analysis and threshold tuning.

import { appendFile } from 'fs/promises';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const PENDING_FILE = '/tmp/botblock-pending';
const DEFAULT_BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Never firewall these IPs, even if detection logic flags them. Partner
// servers must stay reachable.
const IP_WHITELIST = new Set<string>([
  '127.0.0.1',
  '::1',
  '178.156.177.56', // partner server
]);

export interface BlockContext {
  reason: string;
  durationMs?: number;
  userAgent?: string;
  path?: string;
  actionId?: string;
}

export interface SuspiciousContext {
  reason: string;
  userAgent?: string;
  path?: string;
  actionId?: string;
}

function isBlockable(ip: string): boolean {
  if (!ip) return false;
  if (IP_WHITELIST.has(ip)) return false;
  // Only IPv4 at the moment; the watcher script validates format too.
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip);
}

/**
 * Block an IP at both the database and firewall level.
 * Safe to call multiple times for the same IP — violationCount increments
 * and expiresAt extends.
 */
export async function blockIP(ip: string, ctx: BlockContext): Promise<void> {
  if (!isBlockable(ip)) return;

  const durationMs = ctx.durationMs ?? DEFAULT_BLOCK_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);

  try {
    await prisma.blockedIP.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip,
        reason: ctx.reason,
        expiresAt,
        lastUserAgent: ctx.userAgent,
        lastPath: ctx.path,
        lastActionId: ctx.actionId,
      },
      update: {
        reason: ctx.reason,
        expiresAt,
        violationCount: { increment: 1 },
        lastUserAgent: ctx.userAgent,
        lastPath: ctx.path,
        lastActionId: ctx.actionId,
      },
    });
  } catch (error) {
    logger.error('botblock: failed to persist block', { error, ip });
    // Fall through — we still try the firewall notify. A block that makes it
    // to iptables but not the DB is better than one that makes it nowhere.
  }

  try {
    await appendFile(PENDING_FILE, `${ip}\n`);
  } catch (error) {
    logger.error('botblock: failed to write pending file', { error, ip });
  }
}

/**
 * Record suspicious activity without blocking. Useful for tuning thresholds
 * or building a picture of who to block later.
 */
export async function recordSuspicious(
  ip: string,
  ctx: SuspiciousContext,
): Promise<void> {
  if (!ip) return;
  try {
    await prisma.suspiciousActivity.create({
      data: {
        ipAddress: ip,
        reason: ctx.reason,
        userAgent: ctx.userAgent,
        path: ctx.path,
        actionId: ctx.actionId,
      },
    });
  } catch (error) {
    logger.error('botblock: failed to log suspicious activity', { error, ip });
  }
}

/**
 * True if the IP is currently on the block list and not yet expired.
 */
export async function isBlocked(ip: string): Promise<boolean> {
  if (!ip || IP_WHITELIST.has(ip)) return false;
  const row = await prisma.blockedIP.findUnique({
    where: { ipAddress: ip },
    select: { expiresAt: true },
  });
  return !!row && row.expiresAt > new Date();
}
