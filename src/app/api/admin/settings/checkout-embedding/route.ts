// GET / PUT /api/admin/settings/checkout-embedding
// Manage which partner sites may embed the hosted checkout.
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { getFrameAncestors, setFrameAncestors, normaliseOrigin, isValidFrameOrigin, frameAncestorsDirective } from '@/lib/checkout/frame-ancestors';

export const dynamic = 'force-dynamic';

const ROLES = ['SUPER_ADMIN', 'ADMIN'];

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ROLES);
  if (!auth.authorized) return auth.response!;
  const current = await getFrameAncestors();
  return NextResponse.json({ success: true, ...current, header: frameAncestorsDirective(current.origins) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ROLES);
  if (!auth.authorized || !auth.admin) return auth.response!;
  try {
    const body = await request.json().catch(() => ({}));
    const raw: unknown = body?.origins;
    if (!Array.isArray(raw) || raw.length > 100) {
      return NextResponse.json({ error: 'origins must be an array of up to 100 entries' }, { status: 400 });
    }
    const invalid: string[] = [];
    const origins: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const o = normaliseOrigin(item);
      if (!o) continue;
      if (isValidFrameOrigin(o)) origins.push(o);
      else invalid.push(item);
    }
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Not valid origins: ${invalid.join(', ')}. Use the form https://example.com or https://*.example.com — scheme and host only, no path.` },
        { status: 400 },
      );
    }
    const before = (await getFrameAncestors()).origins;
    const saved = await setFrameAncestors(origins, auth.admin.id);
    await logAdminAction(
      auth.admin.id,
      'CHECKOUT_EMBEDDING_UPDATE',
      'settings',
      undefined,
      { before, after: saved },
      getClientIP(request),
      getUserAgent(request),
    );
    return NextResponse.json({ success: true, origins: saved, source: 'database', header: frameAncestorsDirective(saved) });
  } catch (error) {
    logger.apiError('Checkout embedding settings error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
