// lib/checkout/theme.ts
// Theming for the DC-hosted checkout page.
//
// The checkout is usually shown inside a partner's iframe, and a
// cross-origin iframe cannot read its host page's CSS — so "inherit the
// host's look" has to be handed to us explicitly. Two channels carry the
// same four values:
//
//   - query params on the checkout URL: ?theme=dark|light|auto
//     &bg=1a1a1a&text=f5f5f5&accent=e11d48
//   - a `theme` postMessage from the embedding page (see
//     HostedCheckoutForm.tsx), for hosts that compute colours at runtime.
//
// With no theme input the page renders exactly as it always has (light).
//
// Everything here is pure and shared by the server page and the client
// form so both resolve the same input to the same colours.

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface CheckoutTheme {
  mode: ThemeMode;
  /** Page background, `#rrggbb`. When set, `fg` is set too and `mode` is ignored. */
  bg: string | null;
  fg: string | null;
  /** Button / link colour, `#rrggbb`. */
  accent: string | null;
  /** Readable text colour on top of `accent`. */
  onAccent: string | null;
}

export const THEME_PARAMS = ['theme', 'bg', 'text', 'accent'] as const;

const DARK = { bg: '#0f1115', fg: '#f4f4f5' };
const INK = '#171717';
const PAPER = '#f5f5f5';

/** Accepts `abc`, `#abc`, `aabbcc`, `#aabbcc`; returns `#aabbcc` or null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return `#${h}`;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `amount` (0–1) of `a` mixed into `b`. Mirrors CSS color-mix(in srgb). */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return (
    '#' +
    ca
      .map((v, i) => Math.round(v * amount + cb[i] * (1 - amount)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function readableOn(bg: string): string {
  return contrast(bg, PAPER) >= contrast(bg, INK) ? PAPER : INK;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Validate untrusted theme input (query params or a postMessage body).
 * Anything malformed is dropped rather than rejected, so a bad value
 * degrades to the default look instead of breaking a checkout.
 */
export function parseCheckoutTheme(input: {
  theme?: unknown;
  bg?: unknown;
  text?: unknown;
  accent?: unknown;
}): CheckoutTheme {
  const rawMode = first(input.theme);
  const mode: ThemeMode =
    rawMode === 'dark' || rawMode === 'auto' ? rawMode : 'light';

  const bg = normalizeHex(first(input.bg));
  let fg: string | null = null;
  if (bg) {
    // The amount and the pay button must stay legible whatever the host
    // sends, so a text colour that doesn't clear AA against the
    // background is replaced rather than honoured.
    const text = normalizeHex(first(input.text));
    fg = text && contrast(bg, text) >= 4.5 ? text : readableOn(bg);
  }

  const accent = normalizeHex(first(input.accent));

  return {
    mode,
    bg,
    fg,
    accent,
    onAccent: accent ? (contrast(accent, '#ffffff') >= 3 ? '#ffffff' : INK) : null,
  };
}

/** Attributes + CSS variables for the checkout root element (see globals.css). */
export function themeDomProps(theme: CheckoutTheme): {
  'data-dc-theme'?: 'custom' | 'dark' | 'auto';
  'data-dc-accent'?: '';
  style: Record<string, string>;
} {
  const style: Record<string, string> = {};
  const props: ReturnType<typeof themeDomProps> = { style };

  if (theme.bg && theme.fg) {
    props['data-dc-theme'] = 'custom';
    style['--dc-bg'] = theme.bg;
    style['--dc-fg'] = theme.fg;
    style['color-scheme'] = isDark(theme.bg) ? 'dark' : 'light';
  } else if (theme.mode !== 'light') {
    props['data-dc-theme'] = theme.mode;
  }

  if (theme.accent && theme.onAccent) {
    props['data-dc-accent'] = '';
    style['--dc-accent'] = theme.accent;
    style['--dc-on-accent'] = theme.onAccent;
  }
  return props;
}

function isDark(bg: string): boolean {
  return readableOn(bg) === PAPER;
}

/**
 * Concrete colours for Stripe Elements, which can't read our CSS
 * variables. Returns null for the untouched default look.
 */
export function themePalette(
  theme: CheckoutTheme,
  prefersDark: boolean,
): { dark: boolean; fg: string; field: string; accent: string | null } | null {
  let base: { bg: string; fg: string } | null = null;
  if (theme.bg && theme.fg) base = { bg: theme.bg, fg: theme.fg };
  else if (theme.mode === 'dark' || (theme.mode === 'auto' && prefersDark)) base = DARK;

  if (!base) {
    return theme.accent
      ? { dark: false, fg: INK, field: '#ffffff', accent: theme.accent }
      : null;
  }
  const dark = isDark(base.bg);
  return {
    dark,
    fg: base.fg,
    // Inputs sit on the card (6% mix); lift them a little further on dark
    // so the fields are visible, keep them flush with the card on light.
    field: mixHex(base.fg, base.bg, dark ? 0.1 : 0.06),
    accent: theme.accent,
  };
}
