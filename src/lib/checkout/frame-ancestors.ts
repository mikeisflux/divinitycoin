// lib/checkout/frame-ancestors.ts
// Which sites may embed the hosted checkout in an iframe.
//
// This used to live only in the CHECKOUT_FRAME_ANCESTORS environment
// variable, which meant every new partner embed was an SSH session, a .env
// edit and a pm2 restart. The list now lives in SystemConfig under the same
// key and is managed at /admin/settings/checkout-embedding; the environment
// value is the fallback when nothing has been saved. The edge middleware
// reads the resolved list through /api/checkout/frame-ancestors.

import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';

export const FRAME_ANCESTORS_KEY = 'CHECKOUT_FRAME_ANCESTORS';

/** An https origin, optionally with a leading wildcard label, or localhost for development. */
const ORIGIN_RE = /^https:\/\/(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/;
const LOCALHOST_RE = /^https?:\/\/localhost(:\d{1,5})?$/;

export function normaliseOrigin(raw: string): string {
  return raw.trim().toLowerCase().replace(/\/+$/, '');
}

export function isValidFrameOrigin(origin: string): boolean {
  return ORIGIN_RE.test(origin) || LOCALHOST_RE.test(origin);
}

export function parseOrigins(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const o = normaliseOrigin(part);
    if (o && isValidFrameOrigin(o)) seen.add(o);
  }
  return [...seen];
}

export async function getFrameAncestors(): Promise<{ origins: string[]; source: 'database' | 'environment' | 'none' }> {
  const row = await prisma.systemConfig.findUnique({ where: { key: FRAME_ANCESTORS_KEY }, select: { value: true } });
  if (row) return { origins: parseOrigins(row.value), source: 'database' };
  const env = await getConfig(FRAME_ANCESTORS_KEY, process.env.CHECKOUT_FRAME_ANCESTORS || '');
  return env ? { origins: parseOrigins(env), source: 'environment' } : { origins: [], source: 'none' };
}

export async function setFrameAncestors(origins: string[], adminId: string): Promise<string[]> {
  const clean = parseOrigins(origins.join(' '));
  await prisma.systemConfig.upsert({
    where: { key: FRAME_ANCESTORS_KEY },
    update: { value: clean.join(' '), updatedBy: adminId },
    create: { key: FRAME_ANCESTORS_KEY, value: clean.join(' '), updatedBy: adminId },
  });
  return clean;
}

/** The CSP source list the middleware emits for /checkout/*. */
export function frameAncestorsDirective(origins: string[]): string {
  return origins.length > 0 ? `frame-ancestors 'self' ${origins.join(' ')}` : `frame-ancestors 'none'`;
}
