// lib/chargeback-ban/canonicalize.ts
// Normalize identifier values to the same shape on both sides of the
// match (feed-side input and runtime-side input). Whatever we store as
// `value` on ChargebackBanIdentifier MUST be exactly what
// matchIdentifier() builds from the live request — that's how the
// indexed (type, value) lookup turns into an O(1) hit.

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Lowercased, trimmed. For Gmail, also strip dots in the local part
 * and drop any `+suffix` — both forms route to the same inbox, so a
 * banned `jane.doe+icf@gmail.com` should match `janedoe@gmail.com`.
 */
export function canonicalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (GMAIL_DOMAINS.has(domain)) {
    const plus = local.indexOf('+');
    if (plus >= 0) local = local.slice(0, plus);
    local = local.replace(/\./g, '');
    return `${local}@gmail.com`;
  }
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  return `${local}@${domain}`;
}

/**
 * E.164 strict. We trust upstream to provide E.164; this just strips
 * spaces / dashes / parens that a sloppy producer might leave in.
 */
export function canonicalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Whitespace-collapsed, lowercased. Don't fold accents — the spec
 * explicitly prefers false negatives over fuzzy matching.
 */
export function canonicalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const collapsed = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return collapsed || null;
}

interface AddressInput {
  line1?: string | null;
  postal_code?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Compose a single string key from (line1, postal, country). All three
 * are required — per the spec, if either side lacks a country we skip
 * the match. Postal is lowercased and stripped of whitespace so
 * "97123-1234" and "97123 1234" don't collide spuriously but " 97123 "
 * does match "97123".
 */
export function canonicalizeAddressKey(addr: AddressInput | null | undefined): string | null {
  if (!addr) return null;
  const line1 = (addr.line1 ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const postal = ((addr.postal_code ?? addr.postalCode) ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const country = (addr.country ?? '').trim().toUpperCase();
  if (!line1 || !postal || !country) return null;
  return `${line1}|${postal}|${country}`;
}

/**
 * Card fingerprints are already stable hashes from the acquirer
 * (Stripe payment_method.card.fingerprint). Trim defensively.
 */
export function canonicalizeFingerprint(fp: string | null | undefined): string | null {
  if (!fp) return null;
  const t = fp.trim();
  return t || null;
}

/**
 * IPs as-given but trimmed. Lowercased for IPv6 hex normalization.
 */
export function canonicalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const t = ip.trim().toLowerCase();
  return t || null;
}
