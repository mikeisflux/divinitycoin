// GET /api/checkout/frame-ancestors
// The resolved embed allowlist, for the edge middleware. Public and
// unauthenticated on purpose: the same list is already sent to every
// browser as a response header on /checkout/*, so it is not a secret.
import { NextResponse } from 'next/server';
import { getFrameAncestors } from '@/lib/checkout/frame-ancestors';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { origins } = await getFrameAncestors();
  return NextResponse.json({ origins }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
