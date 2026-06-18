# Operational notes for Claude Code in this repo

These rules exist because of real incidents. Re-read before any session that
touches deploys, env vars, or the prod box.

---

## 1. Never write `<placeholder>` syntax for env vars in shell commands

This caused a prod outage on 2026-06-18.

**Never do this** — even with explanatory comments around it:

```bash
export DATABASE_URL="<your DATABASE_URL>"   # WRONG — gets pasted as-is
psql "$DATABASE_URL" -c "..."
```

If a user pastes it before substituting, `DATABASE_URL=<your DATABASE_URL>` gets
exported into the shell. The next `pm2 restart divinitycoin --update-env` snapshots
that broken value into pm2's process env, and Prisma fails with
*"the URL must start with the protocol postgresql://"* on every DB call until pm2
is fully reset (`pm2 delete` + `pm2 start` + `pm2 save`).

**Instead, always source from `.env`:**

```bash
# Ad-hoc DB query — never persists in the shell:
DBURL=$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"') \
  psql "$DBURL" -c "SELECT 1;"
```

Or, when truly needing it in the user's shell, look up the actual value from
the local `.env` and paste the resolved string, NOT a placeholder.

## 2. pm2 caveats — `--update-env` does not reliably refresh

`pm2 restart <name> --update-env` does NOT always replace pm2's saved process env
from the current shell, especially when pm2 has a stale value persisted. The
reliable hard-reset sequence after an env-var corruption:

```bash
DBURL=$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"')
export DATABASE_URL="$DBURL"
pm2 delete divinitycoin
cd ~/divinitycoin
pm2 start npm --name divinitycoin -- start
pm2 save                    # persists corrected env to /root/.pm2/dump.pm2
pm2 env 0 | grep DATABASE_URL    # must show postgresql://...
```

Always verify with `pm2 env 0 | grep DATABASE_URL` before declaring an incident
resolved.

## 3. Canonical deploy sequence

```bash
cd ~/divinitycoin
unset DATABASE_URL                           # belt-and-suspenders, prevents env inheritance
git pull origin <branch>
npm install --legacy-peer-deps
npx prisma db push                           # only if schema changed
npm run build
pm2 stop divinitycoin && pm2 start divinitycoin --update-env
pm2 list                                     # verify online
curl -sI https://divinitycoin.com/ | head -3 # verify 200
```

**Never** use `pm2 restart` for a deploy — the rolling restart on cluster mode
can leave a stale instance serving HTML with old chunk hashes against the new
`.next/`, producing a CSS-less / "broken" looking site. Always `pm2 stop` then
`pm2 start`.

Hard-refresh the browser (`Ctrl+Shift+R`) after every deploy — Next.js HTML
references chunk hashes that change every build, and the browser cache holds
the old HTML.

## 4. Build environment — `prisma:error` during static page generation is benign

The `Error validating datasource db` warnings that appear during
`npm run build` are from Next.js trying to evaluate dynamic pages at
static-collection time with no DB available. They do not indicate a real
runtime problem; the build completes (`✓ Generating static pages (123/123)`).
Don't flag them as an error or recommend changing the build.

A REAL prod-down condition will show:
1. The same Prisma errors *post-pm2-start* (in `pm2 logs`)
2. AND `pm2 env 0 | grep DATABASE_URL` showing an invalid URL

Both must be true for the site to be down. The build-time warnings alone are not.

## 5. Coexistence guarantee for the partner API

Every change to `src/app/internal/route.ts` and to the broader partner-facing
surface must preserve every existing action's request/response shape and
behavior. Active partner integrations (IndieCrowdfund and others) cannot be
broken by additive work. The pattern:

- New actions added; existing actions untouched.
- Existing schema fields untouched; new fields added with `@default` for backfill.
- Existing webhook events untouched; new events added as opt-in.

Three commits' worth of feature work shipped this branch following this rule
(DC-hosted checkout, checkout.* events, payment.requires_action, iframe support).
Do not break it.

## 6. Stripe — DivinityCoin is a gift card retailer, not a payment processor

Stripe is the licensed payment processor that DC uses. DC (DVCKS1 LLC) is the
seller of digital prepaid credits / gift cards and the merchant of record on
the card transaction.

Do NOT call DC a "payment processor" in:
- Customer-facing copy
- Terms of Service language
- Dispute response letters
- Receipt PDFs
- Partner documentation

This has both legal and chargeback-defense implications. Section 3 of the ToS
and the dispute-bundle response letter were rewritten on 2026-06-18 to reflect
this.

## 7. Branding split

- `divinitycoin.com` (the marketing site, FAQ, homepage, admin, partner portal):
  **DivinityCoin**
- `divinitycoin.com/checkout/*` (the hosted-checkout payment surface):
  **Divinity Payments**

Don't rebrand the main site to "Divinity Payments" — the checkout is the only
place that uses that wordmark.

## 8. Branch convention

Active feature work is on `claude/fix-partner-page-CKQIH`. Commits should be:
- Single, focused change per commit
- Title under 70 chars, imperative mood
- Body explains the *why* and any deploy-step impact (schema migration, env var,
  package install)
- No `--amend`, no `--no-verify`, no force-push without explicit user request

## 9. When the user pastes deploy output, read the bottom carefully

Multiple incidents this session were caused by skim-reading the user's output.
The decisive signal is usually in the last 5-10 lines (final `pm2 list` state,
final `curl -sI` headers, final `pm2 env` value). Don't declare an incident
fixed based on intermediate output.
