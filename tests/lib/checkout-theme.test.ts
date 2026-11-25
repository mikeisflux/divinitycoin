import { describe, it, expect } from 'vitest';
import {
  contrast,
  mixHex,
  normalizeHex,
  parseCheckoutTheme,
  themeDomProps,
  themePalette,
} from '@/lib/checkout/theme';

describe('checkout theme', () => {
  it('leaves an unthemed checkout untouched', () => {
    const theme = parseCheckoutTheme({});
    expect(themeDomProps(theme)).toEqual({ style: {} });
    expect(themePalette(theme, true)).toBeNull();
  });

  it('normalises hex and rejects anything else', () => {
    expect(normalizeHex('ABC')).toBe('#aabbcc');
    expect(normalizeHex('#1a2B3c')).toBe('#1a2b3c');
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('fff;background:url(x)')).toBeNull();
    expect(normalizeHex(['fff'])).toBeNull();
  });

  it('drops malformed input instead of failing', () => {
    const theme = parseCheckoutTheme({ theme: 'neon', bg: 'javascript:1', accent: 12 });
    expect(theme).toEqual({ mode: 'light', bg: null, fg: null, accent: null, onAccent: null });
  });

  it('marks dark and auto on the shell without inline colours', () => {
    expect(themeDomProps(parseCheckoutTheme({ theme: 'dark' }))).toEqual({
      'data-dc-theme': 'dark',
      style: {},
    });
    expect(themeDomProps(parseCheckoutTheme({ theme: 'auto' }))['data-dc-theme']).toBe('auto');
  });

  it('resolves auto against the device preference', () => {
    const theme = parseCheckoutTheme({ theme: 'auto' });
    expect(themePalette(theme, false)).toBeNull();
    expect(themePalette(theme, true)?.dark).toBe(true);
  });

  it('applies partner colours', () => {
    const theme = parseCheckoutTheme({ bg: '14110f', text: 'f5ede6', accent: 'e11d48' });
    const props = themeDomProps(theme);
    expect(props['data-dc-theme']).toBe('custom');
    expect(props.style).toMatchObject({
      '--dc-bg': '#14110f',
      '--dc-fg': '#f5ede6',
      '--dc-accent': '#e11d48',
      '--dc-on-accent': '#ffffff',
      'color-scheme': 'dark',
    });
    expect(themePalette(theme, false)).toMatchObject({ dark: true, accent: '#e11d48' });
  });

  it('replaces a text colour that would be unreadable on the background', () => {
    const theme = parseCheckoutTheme({ bg: '111111', text: '1a1a1a' });
    expect(contrast(theme.bg!, theme.fg!)).toBeGreaterThan(4.5);
    const light = parseCheckoutTheme({ bg: 'ffffff', text: 'fefefe' });
    expect(light.fg).toBe('#171717');
  });

  it('ignores a text colour given without a background', () => {
    expect(parseCheckoutTheme({ text: 'ff0000' }).fg).toBeNull();
  });

  it('uses dark text on a light accent', () => {
    expect(parseCheckoutTheme({ accent: 'fde047' }).onAccent).toBe('#171717');
  });

  it('mixes like CSS color-mix', () => {
    expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#ff0000');
  });
});
