# nginx: let the partner API signpost its own wrong path

## The problem this solves

The partner API is served at `/internal`. Every other route on the host is
under `/api/`, so partners assume `/api/internal/…` and get nginx's stock HTML
`403` — before the application sees the request.

That failure is actively misleading. It looks like a rejected API key or a
blocked source IP, so partners debug credentials and firewall rules instead of
the URL. Play Time TCG lost days to it and opened a ticket asking us to
allowlist their IP, which would not have fixed anything.

## The fix

The application now answers `/api/internal/*` with a JSON 404 naming the
correct URL, the accepted actions and the auth header. nginx has to stop
intercepting that prefix for it to be reachable.

Find the block that denies `/api/internal/` and replace it with a proxy pass to
the app, so the signpost is what the partner sees:

```nginx
# Partner API wrong-path signpost. The real endpoint is /internal; this prefix
# exists only so a misdirected partner gets a JSON 404 that tells them where to
# go, instead of an HTML 403 that reads like an auth or firewall problem.
location /api/internal/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin            $scheme://$host;
}
```

Then:

```bash
nginx -t && systemctl reload nginx
```

## Verify

```bash
curl -s https://divinitycoin.com/api/internal/validate | head -c 200
```

Expect JSON containing `"correctUrl"`, not HTML. And confirm the real endpoint
still rejects cleanly:

```bash
curl -s -X POST https://divinitycoin.com/internal?action=validate
```

Expect `{"error":"Missing or invalid Authorization header"}`.

## What this is not

This does not expose anything. `/api/internal/*` has no handler beyond the
signpost — it never touches a partner record, a key, or the database, and every
method returns the same 404 body. Authentication on the real `/internal`
endpoint is unchanged.
