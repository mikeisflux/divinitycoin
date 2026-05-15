'use client';

// Tiny client component that bounces the user to the partner's
// returnUrl after a brief moment. Rendered on terminal session
// states so the user gets a chance to see the success/cancel UI
// before being redirected.

import { useEffect } from 'react';

export function TerminalRedirect({ url, delayMs }: { url: string; delayMs: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.replace(url);
    }, delayMs);
    return () => clearTimeout(t);
  }, [url, delayMs]);
  return null;
}
