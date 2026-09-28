// app/api/internal/[[...path]]/route.ts
// Signpost for a wrong guess at the partner API's base path.
//
// The internal API is served at /internal, not /api/internal. Partners
// reasonably assume the /api prefix used by every other route on this host,
// get an opaque rejection, and conclude their key or their IP is at fault —
// one partner spent days on that before asking. This route answers with the
// correct URL instead of leaving them to guess.
//
// NOTE: nginx must not intercept /api/internal/ for this to be reachable.
// See docs/NGINX-PARTNER-API.md.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { INTERNAL_POST_ACTIONS, INTERNAL_GET_ACTIONS } from '@/lib/partner/internal-actions';

function signpost(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const correct = `${url.origin}/internal${action ? `?action=${action}` : '?action=<action>'}`;

  return NextResponse.json(
    {
      error: 'Wrong base path. The DivinityCoin partner API is served at /internal, not /api/internal.',
      correctUrl: correct,
      example: `curl -X POST "${url.origin}/internal?action=validate" -H "Authorization: Bearer <your API key>" -H "Content-Type: application/json" -d '{"code":"..."}'`,
      authentication: 'Authorization: Bearer <your API key>. Not X-API-Key.',
      actions: { POST: INTERNAL_POST_ACTIONS, GET: INTERNAL_GET_ACTIONS },
      documentation: `${url.origin}/developers`,
    },
    { status: 404 },
  );
}

export const GET = signpost;
export const POST = signpost;
export const PUT = signpost;
export const PATCH = signpost;
export const DELETE = signpost;
