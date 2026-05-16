'use client';

// app/checkout/[sessionToken]/HostedCheckoutForm.tsx
// Stripe Elements form mounted inside the DC-hosted checkout page.
//
// Three contexts this component runs in, each with slightly different
// behavior:
//
//   1. Top-level (default).
//      Renders Express Checkout (Apple Pay / Google Pay / Link) on top of
//      the standard Payment Element. Submits via Stripe.confirmPayment /
//      confirmSetup, posts to /api/checkout/<token>/complete, redirects
//      to the partner's returnUrl with ?session_id=...
//
//   2. Embedded inside a partner-origin iframe.
//      Same submit flow as #1, but additionally posts a ready/resize/
//      complete message stream to window.parent so the partner page can
//      auto-size the iframe and react to terminal state. On completion
//      we top-nav to the partner's returnUrl by default (escapes the
//      iframe naturally); partners that want to intercept can listen
//      for the "complete" postMessage and hide the iframe before we
//      navigate.
//
//   3. Embedded inside an iframe on iOS WebKit (mobile Safari, in-app
//      browsers).
//      3DS / SCA challenges and wallet buttons can't reliably execute
//      inside a cross-origin iframe on WebKit, so we don't try. Instead
//      we render a "Continue securely" button that opens the same
//      checkout URL in a top-level popup window — that popup runs as
//      context #1 (top-level, no iframe), so everything just works.
//      When the popup completes it postMessages back to the opener
//      iframe; the iframe also polls /api/checkout/<token>/status as a
//      backstop in case the popup is closed forcibly or postMessage is
//      blocked. Either path triggers the same top-nav to the partner's
//      returnUrl.

import { useEffect, useMemo, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

interface Props {
  sessionToken: string;
  publishableKey: string;
  clientSecret: string;
  mode: 'payment' | 'setup';
  amountLabel: string | null;     // null in setup mode
  partnerName: string | null;
  returnUrl: string | null;
  cancelUrl: string | null;
  /**
   * When true, the iframe still emits the `complete` postMessage on
   * terminal state but does NOT top-nav to returnUrl. The embedding
   * partner is responsible for navigation (typical when they want to
   * transition their own UI in place after receiving the message).
   */
  disableAutoRedirect: boolean;
}

// All postMessage payloads we exchange (iframe ↔ partner, popup ↔ opener)
// share this namespace so the partner page can cheaply filter ours from
// any other postMessage traffic on the window.
const MSG_NAMESPACE = 'divinitycoin-checkout';

function appendSessionId(url: string, sessionToken: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('session_id', sessionToken);
    return u.toString();
  } catch {
    return url;
  }
}

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // SecurityError accessing window.top means we're in a cross-origin
    // frame, which by definition means we're in an iframe.
    return true;
  }
}

function isWebkitIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Covers iPhone / iPad / iPod regardless of which browser app
  // (Safari, Chrome, Firefox, in-app webviews) — they all use WebKit on
  // iOS and share the same iframe-restriction behavior for 3DS.
  return /iP(ad|hone|od)/.test(navigator.userAgent);
}

function hasOpener(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.opener && window.opener !== window;
  } catch {
    return false;
  }
}

function safeTopNav(url: string) {
  try {
    if (window.top) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // fall through
  }
  window.location.href = url;
}

function postToParent(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.parent.postMessage({ namespace: MSG_NAMESPACE, ...payload }, '*');
  } catch {
    // swallow — partner page is opaque to us, message just doesn't land
  }
}

function postToOpener(payload: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.opener) return;
  try {
    // Same-origin (the opener IS our own iframe at divinitycoin.com), so
    // we can restrict the target origin tightly.
    window.opener.postMessage(
      { namespace: MSG_NAMESPACE, ...payload },
      window.location.origin,
    );
  } catch {
    // swallow
  }
}

function InnerForm({
  sessionToken,
  mode,
  amountLabel,
  partnerName,
  returnUrl,
  cancelUrl,
  disableAutoRedirect,
}: Pick<Props, 'sessionToken' | 'mode' | 'amountLabel' | 'partnerName' | 'returnUrl' | 'cancelUrl' | 'disableAutoRedirect'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [walletsReady, setWalletsReady] = useState(false);
  const [popupMode, setPopupMode] = useState(false);
  const [popupOpened, setPopupOpened] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // ── Detect context #3 (iframe + iOS WebKit) and switch to popup UX ──
  useEffect(() => {
    if (isInIframe() && isWebkitIos()) {
      setPopupMode(true);
    }
  }, []);

  // ── Iframe → partner page: announce ready + stream resize events ──
  useEffect(() => {
    if (typeof window === 'undefined' || !isInIframe()) return;

    postToParent({ type: 'ready', sessionId: sessionToken });

    const sendResize = () => {
      const height = document.body.scrollHeight;
      postToParent({ type: 'resize', sessionId: sessionToken, height });
    };
    sendResize();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sendResize);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [sessionToken]);

  // ── Post-3DS-redirect detection (Stripe sent us back with a secret
  // in the URL); finalize and redirect. ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !stripe) return;
    const url = new URL(window.location.href);
    const piSecret = url.searchParams.get('payment_intent_client_secret');
    const siSecret = url.searchParams.get('setup_intent_client_secret');
    if (!piSecret && !siSecret) return;
    completeAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe]);

  // ── Popup-mode: while the popup is open in another tab, listen for
  // its completion postMessage AND poll a lightweight status endpoint
  // as a backstop in case the popup is closed forcibly or its message
  // never lands. ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!popupMode || !popupOpened) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || data.namespace !== MSG_NAMESPACE) return;
      if (data.type !== 'complete') return;
      if (data.sessionId !== sessionToken) return;
      handleTerminal(data.status, data.redirectUrl);
    };
    window.addEventListener('message', handleMessage);

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/${sessionToken}/status`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = await res.json();
        if (body.status && body.status !== 'pending') {
          handleTerminal(body.status, body.redirectUrl);
        }
      } catch {
        // ignore transient errors; next tick retries
      }
    }, 2500);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupMode, popupOpened, sessionToken]);

  function handleTerminal(status: string, redirectUrl: string | null) {
    setDone(true);
    if (isInIframe()) {
      postToParent({
        type: 'complete',
        sessionId: sessionToken,
        status,
        redirectUrl,
        disableAutoRedirect,
      });
    }
    // When disableAutoRedirect is true, we intentionally stop here —
    // the partner has taken ownership of post-completion navigation.
    // (We queue the top-nav synchronously, so the partner's message
    // handler can't reliably cancel a pending nav after the fact —
    // not navigating in the first place is the only clean answer.)
    if (redirectUrl && !disableAutoRedirect) safeTopNav(redirectUrl);
  }

  async function completeAndRedirect() {
    try {
      const res = await fetch(`/api/checkout/${sessionToken}/complete`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setError(
          body?.error ||
            (mode === 'payment'
              ? 'Could not finalize payment'
              : 'Could not finalize card setup'),
        );
        return;
      }
      const target = body.redirectUrl as string | null;
      const status = body.status as string;

      // If we're a popup opened by the iframe (context #3 from the
      // header comment), hand off to our opener and close ourselves —
      // the iframe takes over and navigates the top frame.
      if (hasOpener()) {
        postToOpener({
          type: 'complete',
          sessionId: sessionToken,
          status,
          redirectUrl: target,
        });
        setDone(true);
        try { window.close(); } catch { /* swallow */ }
        return;
      }

      // Top-level or iframe (contexts #1 / #2). Same terminal handling.
      handleTerminal(status, target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize');
    }
  }

  async function confirmCurrent(returnHere: string): Promise<{ ok: boolean; error?: string }> {
    if (!stripe || !elements) return { ok: false, error: 'Payment not ready' };
    if (mode === 'payment') {
      const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnHere },
        redirect: 'if_required',
      });
      if (confirmErr) return { ok: false, error: confirmErr.message || 'Payment failed' };
      if (paymentIntent && paymentIntent.status === 'succeeded') return { ok: true };
      return { ok: false, error: 'Payment did not complete. Please try again.' };
    } else {
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnHere },
        redirect: 'if_required',
      });
      if (confirmErr) return { ok: false, error: confirmErr.message || 'Card setup failed' };
      if (setupIntent && setupIntent.status === 'succeeded') return { ok: true };
      return { ok: false, error: 'Card was not saved. Please try again.' };
    }
  }

  async function runConfirmFlow() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const returnHere = `${window.location.origin}/checkout/${sessionToken}`;
    const result = await confirmCurrent(returnHere);

    if (!result.ok) {
      setError(result.error ?? 'Could not complete');
      setSubmitting(false);
      return;
    }

    await completeAndRedirect();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runConfirmFlow();
  }

  function openPopup() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const features = 'popup=1,width=440,height=720,scrollbars=yes,resizable=yes';
    // Deliberately NOT 'noopener' — we want the popup's window.opener
    // so it can postMessage results back to us.
    const w = window.open(url, 'dc_checkout', features);
    if (!w) {
      setPopupBlocked(true);
      return;
    }
    setPopupBlocked(false);
    setPopupOpened(true);
    try { w.focus(); } catch { /* swallow */ }
  }

  const partnerCancelHref = cancelUrl ?? returnUrl ?? null;
  const buttonLabel = submitting
    ? 'Processing…'
    : mode === 'payment'
      ? `Pay ${amountLabel ?? ''}`
      : 'Save card';

  if (done) {
    return (
      <div className="text-center py-6">
        <p className="text-neutral-700">
          {mode === 'payment' ? 'Payment complete' : 'Card saved'}. Returning to {partnerName ?? 'the partner site'}…
        </p>
      </div>
    );
  }

  // ── Popup-failover UI (context #3) ────────────────────────────────
  if (popupMode) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            For secure 3D Secure verification on this device, please complete your payment in a new tab.
          </p>
        </div>

        <button
          type="button"
          onClick={openPopup}
          disabled={popupOpened}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-60 disabled:cursor-default"
        >
          {popupOpened
            ? 'Waiting for payment in the new tab…'
            : mode === 'payment'
              ? `Continue securely · ${amountLabel ?? ''}`
              : 'Continue to save your card'}
        </button>

        {popupBlocked && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            Your browser blocked the new tab. Tap the button again, or{' '}
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_top"
              className="underline font-medium"
            >
              open in this tab
            </a>{' '}
            instead.
          </div>
        )}

        {popupOpened && (
          <button
            type="button"
            onClick={() => setPopupOpened(false)}
            className="block text-xs text-neutral-500 underline mx-auto"
          >
            Cancel and try a different way
          </button>
        )}

        {partnerCancelHref && !popupOpened && (
          <div className="text-center">
            <a
              href={appendSessionId(partnerCancelHref, sessionToken)}
              target="_top"
              className="text-sm text-neutral-500 hover:text-neutral-700 underline"
            >
              Cancel and return to {partnerName ?? 'partner site'}
            </a>
          </div>
        )}
      </div>
    );
  }

  // ── Standard form (contexts #1 and #2) ────────────────────────────
  return (
    <div className="space-y-5">
      {/* Wallet buttons (Apple Pay / Google Pay / Link). Renders nothing
          when no wallet is available in the user's browser. */}
      <ExpressCheckoutElement
        onConfirm={() => { void runConfirmFlow(); }}
        onReady={(event) => {
          const available = event.availablePaymentMethods;
          setWalletsReady(
            !!available && Object.values(available).some(Boolean),
          );
        }}
      />

      {walletsReady && (
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-400">
          <div className="flex-1 h-px bg-neutral-200" />
          <span>or pay with card</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <PaymentElement options={{ layout: 'tabs' }} />

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || submitting}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>

        {partnerCancelHref && (
          <div className="text-center">
            <a
              href={appendSessionId(partnerCancelHref, sessionToken)}
              target={isInIframe() ? '_top' : undefined}
              className="text-sm text-neutral-500 hover:text-neutral-700 underline"
            >
              Cancel and return to {partnerName ?? 'partner site'}
            </a>
          </div>
        )}
      </form>
    </div>
  );
}

export function HostedCheckoutForm(props: Props) {
  const stripePromise = useMemo<Promise<Stripe | null>>(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#6366f1',
            colorBackground: '#ffffff',
            colorText: '#171717',
            colorDanger: '#dc2626',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      }}
    >
      <InnerForm
        sessionToken={props.sessionToken}
        mode={props.mode}
        amountLabel={props.amountLabel}
        partnerName={props.partnerName}
        returnUrl={props.returnUrl}
        cancelUrl={props.cancelUrl}
        disableAutoRedirect={props.disableAutoRedirect}
      />
    </Elements>
  );
}
