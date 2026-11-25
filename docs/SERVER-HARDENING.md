# Server hardening and activity review

Written against **FBI FLASH-20261113-001**, "Threat Overview of ARTEX
Autonomous Penetration Testing Framework" (13 November 2026, TLP:CLEAR).
ARTEX is an LLM-driven agentic attack framework; it targets partner portals,
login endpoints and overlooked integrations first, and moves from first
contact to privileged access in hours. Everything below is either something
the FLASH asks for or the way to check whether its indicators have already
touched this box.

All commands run on the server as root from `~/divinitycoin` unless stated.
None of them paste a secret: values come from `.env` inline.

## What is already in place

| Control | Where |
|---|---|
| SSH restricted to known addresses | Hetzner host firewall (port 22 allowlist) — the primary control |
| Admin and partner login throttled | nginx `login` zone, 5/min, burst 3 |
| Admin account lockout | `loginAdmin()` — 5 failures, 15-minute lock |
| Security headers | `src/proxy.ts` — HSTS, nosniff, X-Frame-Options DENY, CSP frame-ancestors on `/checkout` (allowlist managed at `/admin/settings/checkout-embedding`) |
| Bot / rate abuse → firewall | `src/proxy.ts` + BotBlock (iptables) |
| Sensitive path probes 404 | `src/proxy.ts` (`/.env`, `/.git`, `/prisma` …) |
| Partner API request log | `ApiRequestLog`, every `/internal` call, since `b95f000` |
| Security event stream | `SecurityEvent` — sign-ins, failures, lockouts, API auth failures, IOC hits, anomalies |
| Partner API limits | 20 failed auths / IP / 10 min; 600 req / key / min |
| Customer login / reset limits | 10 / IP / min; 5 / IP / 15 min |
| IOC matching | `src/lib/security/iocs.ts`, alerted by email; `IOC_BLOCK_MODE=block` to refuse |
| Volume anomaly alerts | `/api/cron/security-anomalies` every 15 min |
| Settlement actions | finance roles only |
| Admin MFA | TOTP via authenticator app, `/admin/settings/mfa`; `REQUIRE_MFA` in Security settings forces enrolment at next sign-in |

## Crontab additions for this work

Clone an existing line so the secret is copied, not typed:

```bash
( crontab -l; crontab -l | grep -m1 'chargeback-ban-sync' \
  | sed -e 's#chargeback-ban-sync#security-anomalies#' -e 's#^\*/5 #*/15 #' ) | crontab -
crontab -l | grep security-anomalies
```

## Optional: restrict /admin to your addresses

The equivalent of the SSH firewall rule, for the one interface that shares
port 443 with the public site. **Dynamic home IPs and CGNAT will lock you
out** — only set this if your address is static, or include a range.

```bash
cd ~/divinitycoin
printf 'ADMIN_IP_ALLOWLIST="%s"\n' "$(curl -s https://api.ipify.org)" >> .env   # your current public IP
grep ADMIN_IP_ALLOWLIST .env
pm2 delete divinitycoin && pm2 start npm --name divinitycoin -- start && pm2 save
```

Add more entries comma-separated (`1.2.3.4,5.6.7.0/24`). Denied attempts
appear in the security log as `ADMIN_ALLOWLIST_DENIED`.

**Recovery if locked out:** SSH in (the firewall allows you), remove the
line from `.env`, `pm2 delete` + `pm2 start` + `pm2 save` as above.

## Optional: refuse FBI-listed addresses at the edge

Default is log-and-alert, per the FBI's note that these addresses are
historical and reassignable. To block instead:

```bash
printf 'IOC_BLOCK_MODE=block\n' >> .env
pm2 delete divinitycoin && pm2 start npm --name divinitycoin -- start && pm2 save
```

## Review activity since 1 October 2026

The FLASH asks for this explicitly. Run each; anything unexpected, keep the
output and stop before changing anything (preserve evidence first).

### 1. Has any FBI-listed address touched the box?

nginx access logs, all rotations:

```bash
zgrep -hE '^(38\.244\.50\.120|144\.172\.64\.(60|99|128)|187\.15\.(88\.186|90\.217|89\.186)|101\.53\.80\.20|205\.214\.59\.31|124\.155\.252\.63|154\.201\.79\.246|23\.248\.249\.90|23\.158\.220\.98|103\.248\.148\.84|203\.160\.133\.172|209\.209\.85\.38|199\.19\.95\.(66|67|68)|91\.92\.240\.238|85\.11\.168\.45|178\.16\.54\.129|31\.77\.229\.35|85\.11\.167\.52) ' /var/log/nginx/access.log* | head -50
```

Empty output is the answer you want. SSH is firewalled, so `auth.log` cannot
have them, but confirm nothing else listens:

```bash
ss -tlnp | grep -vE '127\.0\.0\.1|::1'
```

Only nginx (80/443) and sshd (22) should be bound to a public interface.

### 2. Is the box talking to an LLM API?

The application never calls these. An established connection is a finding.

```bash
ss -tnp state established | grep -E ':443' | awk '{print $4}' | cut -d: -f1 | sort -u \
  | xargs -I{} sh -c 'echo "{} $(getent hosts {} | awk "{print \$2}")"' 2>/dev/null \
  | grep -iE 'anthropic|deepseek|bigmodel|x\.ai|xcai' || echo "no LLM API connections"
```

Also check what resolves on the box recently, if `systemd-resolved` is in use:

```bash
journalctl -u systemd-resolved --since "2026-10-01" 2>/dev/null | grep -iE 'anthropic|deepseek|bigmodel|x\.ai|xcai' | head || echo "nothing in resolver log"
```

### 3. Directory fuzzing bursts (the FLASH: "500+ requests")

Addresses with the most 404s since October, and the top three per day:

```bash
zcat -f /var/log/nginx/access.log* | awk '$9==404 {print $1}' | sort | uniq -c | sort -rn | head -20
```

Anything in the hundreds from one address in one day is a scanner. Check
whether BotBlock already has it:

```bash
iptables -L -n | grep -c DROP
```

### 4. Persistence artefacts

New SSH keys, cron entries, web shells, unexpected users:

```bash
echo "--- authorized_keys (expect only yours) ---"; cat /root/.ssh/authorized_keys 2>/dev/null
echo "--- root crontab ---"; crontab -l
echo "--- system cron ---"; ls -la /etc/cron.d/ /etc/cron.daily/ | grep -vE 'total|\.\.?$'
echo "--- users with a shell ---"; grep -E '/bin/(ba)?sh$' /etc/passwd
echo "--- scripts in web paths (expect none) ---"; find /root/divinitycoin/public /var/www -type f \( -name '*.php' -o -name '*.jsp' -o -name '*.aspx' \) 2>/dev/null
echo "--- recently modified under the app, excluding builds ---"; find /root/divinitycoin -newermt '2026-10-01' -type f -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' | head -30
```

That last list should contain only files you or a deploy changed.

### 5. The application's own records

Failed sign-ins and partner API auth failures since the streams started:

```bash
psql -P pager=off "$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"')" -c "
SELECT type, realm, count(*), min(\"createdAt\") AS first, max(\"createdAt\") AS last
FROM \"SecurityEvent\" GROUP BY type, realm ORDER BY count DESC;"
```

Admin accounts and when each last logged in — any you do not recognise is
an incident:

```bash
psql -P pager=off "$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"')" -c "
SELECT email, role, \"mfaEnabled\", \"lastLoginAt\", \"lastLoginIp\", \"createdAt\" FROM \"AdminUser\" ORDER BY \"createdAt\";"
```

Partner API keys created since October and their last use:

```bash
psql -P pager=off "$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"')" -c "
SELECT k.id, p.name, k.\"createdAt\", k.\"lastUsedAt\", k.\"revokedAt\" FROM \"PartnerApiKey\" k JOIN \"Partner\" p ON p.id=k.\"partnerId\" WHERE k.\"createdAt\" >= '2026-10-01' ORDER BY k.\"createdAt\";"
```

## Defence in depth, not urgent

- **SSH key-only auth.** The firewall allowlist is the control; this removes
  the password as a factor if the allowlist is ever widened. Add your key
  first, prove a second session works with it, *then* set
  `PasswordAuthentication no` and `PermitRootLogin prohibit-password` in
  `/etc/ssh/sshd_config` and `systemctl reload ssh`. Never disable passwords
  before the key login is confirmed from a fresh terminal.
- **fail2ban** on the nginx login zone would move repeat offenders from a
  429 to a firewall drop. BotBlock already does this for general abuse.

## If something above is a finding

1. Do not delete anything. Copy logs off the box first.
2. Rotate what the finding could have exposed — `.env` holds the Stripe keys,
   the webhook secret, the database URL and the cron secret.
3. Report to the FBI Internet Crime Complaint Center at **www.ic3.gov**,
   referencing FLASH-20261113-001, with the date, time, addresses, and the
   log excerpts. The FLASH lists what they want on pages 8–9.
