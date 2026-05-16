'use client';

// app/checkout/[sessionToken]/HostedCheckoutForm.tsx
//
// Top-level orchestrator for the hosted-checkout payment surface. Routes
// to one of three sub-views depending on context, with a deliberate
// "don't load Stripe.js until the user demonstrates intent" gate:
//
//   1. Top-level (default).
//      Renders a "Continue to pay" CTA. Until the user taps it, Stripe.js
//      is NOT loaded — nothing on the page references js.stripe.com or
//      m.stripe.network in network logs. Casual visitors / devtools
//      pokers who never tap don't trigger any third-party calls.
//      On tap, we mount Elements, which loads Stripe.js, and the real
//      Payment Element + Express Checkout (Apple Pay / Google Pay / Link)
//      render. Standard confirm-and-finalize flow from there.
//
//   2. Embedded inside an iframe on iOS WebKit.
//      3DS / SCA and wallets can't reliably run in a cross-origin iframe
//      on WebKit, so we don't try. Skips both the reveal gate AND the
//      Elements mount — renders a "Continue securely" button that opens
//      the same checkout URL in a top-level popup window. The popup
//      runs as context #1, autoreveals (since it has an opener), loads
//      Stripe, and completes payment. It postMessages the result back to
//      the iframe + closes itself; the iframe also polls
//      /api/checkout/<token>/status as a backstop in case the popup is
//      killed or its message is blocked.
//
//   3. Returning from a 3DS / SCA redirect.
//      Stripe sends the user back to this same URL with
//      ?payment_intent_client_secret=... or ?setup_intent_client_secret=...
//      We MUST complete the flow when that happens, so we skip the
//      reveal gate entirely and mount Elements immediately.

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
  disableAutoRedirect: boolean;
}

const MSG_NAMESPACE = 'divinitycoin-checkout';

// ─── Utilities ──────────────────────────────────────────────────────

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isWebkitIos(): boolean {
  if (typeof navigator === 'undefined') return false;
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

function has3dsReturnParams(): boolean {
  if (typeof window === 'undefined') return false;
  const sp = new URL(window.location.href).searchParams;
  return sp.has('payment_intent_client_secret') || sp.has('setup_intent_client_secret');
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
    // swallow
  }
}

function postToOpener(payload: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.opener) return;
  try {
    window.opener.postMessage(
      { namespace: MSG_NAMESPACE, ...payload },
      window.location.origin,
    );
  } catch {
    // swallow
  }
}

// ─── Reveal CTA — pre-Stripe gate ──────────────────────────────────

function RevealCTA({
  mode,
  amountLabel,
  onReveal,
}: {
  mode: 'payment' | 'setup';
  amountLabel: string | null;
  onReveal: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onReveal}
        className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition"
      >
        {mode === 'payment'
          ? `Continue to pay ${amountLabel ?? ''}`
          : 'Continue to save your card'}
      </button>
      <p className="text-xs text-neutral-500 text-center">
        Secure payment form loads only after you proceed.
      </p>
    </div>
  );
}

// ─── Popup-failover UI — context #2 ────────────────────────────────
// No Stripe Elements mounted here; the actual payment happens in the
// popup window, which runs as context #1 (auto-revealed via opener).

function PopupFailoverUI({
  sessionToken,
  mode,
  amountLabel,
  partnerName,
  disableAutoRedirect,
}: Pick<Props, 'sessionToken' | 'mode' | 'amountLabel' | 'partnerName' | 'disableAutoRedirect'>) {
  const [popupOpened, setPopupOpened] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [done, setDone] = useState(false);

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
    if (redirectUrl && !disableAutoRedirect) safeTopNav(redirectUrl);
  }

  useEffect(() => {
    if (!popupOpened) return;

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
        // ignore transient errors
      }
    }, 2500);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupOpened, sessionToken]);

  function openPopup() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const features = 'popup=1,width=440,height=720,scrollbars=yes,resizable=yes';
    const w = window.open(url, 'dc_checkout', features);
    if (!w) {
      setPopupBlocked(true);
      return;
    }
    setPopupBlocked(false);
    setPopupOpened(true);
    try { w.focus(); } catch { /* swallow */ }
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <p className="text-neutral-700">
          {mode === 'payment' ? 'Payment complete' : 'Card saved'}. Returning to {partnerName ?? 'the partner site'}…
        </p>
      </div>
    );
  }

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
    </div>
  );
}

// ─── Stripe form — mounted inside <Elements>, assumes Stripe loaded ─

function StripeForm({
  sessionToken,
  mode,
  amountLabel,
  partnerName,
  disableAutoRedirect,
}: Pick<Props, 'sessionToken' | 'mode' | 'amountLabel' | 'partnerName' | 'disableAutoRedirect'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [walletsReady, setWalletsReady] = useState(false);

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
    if (redirectUrl && !disableAutoRedirect) safeTopNav(redirectUrl);
  }

  // Post-3DS-redirect detection: if we landed on this URL with Stripe's
  // return-params, immediately finalize without waiting for user input.
  useEffect(() => {
    if (typeof window === 'undefined' || !stripe) return;
    if (!has3dsReturnParams()) return;
    completeAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe]);

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

      // If we're a popup opened from the iframe failover, hand off to
      // the opener and close ourselves.
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

  return (
    <div className="space-y-5">
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
      </form>
    </div>
  );
}

// ─── Top-level orchestrator ────────────────────────────────────────

export function HostedCheckoutForm(props: Props) {
  const [popupMode, setPopupMode] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Context detection on mount. Priority order:
  //   1. Returning from a 3DS challenge → auto-reveal, skip popup mode
  //      (we MUST mount Elements to finalize).
  //   2. iOS WebKit inside iframe → popup-failover mode, don't load Stripe
  //      in this frame at all (the popup will load it instead).
  //   3. Opened as a popup from our own iframe → user already committed
  //      to paying upstream, auto-reveal.
  //   4. Otherwise → render the reveal CTA, defer Stripe.js entirely
  //      until the user taps it.
  useEffect(() => {
    if (has3dsReturnParams()) {
      setRevealed(true);
      return;
    }
    if (isInIframe() && isWebkitIos()) {
      setPopupMode(true);
      return;
    }
    if (hasOpener()) {
      setRevealed(true);
    }
  }, []);

  // Iframe → parent page: announce ready + stream resize events. Fires
  // regardless of which sub-view we render so partners get the same
  // event timing whether the user has interacted yet or not.
  useEffect(() => {
    if (typeof window === 'undefined' || !isInIframe()) return;

    postToParent({ type: 'ready', sessionId: props.sessionToken });

    const sendResize = () => {
      postToParent({
        type: 'resize',
        sessionId: props.sessionToken,
        height: document.body.scrollHeight,
      });
    };
    sendResize();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sendResize);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [props.sessionToken]);

  // Lazy stripePromise — loadStripe only fires after the user reveals
  // (or we auto-revealed). Before then, no js.stripe.com request hits
  // the network, no Stripe origins appear in devtools.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (revealed ? loadStripe(props.publishableKey) : null),
    [revealed, props.publishableKey],
  );

  if (popupMode) {
    return (
      <PopupFailoverUI
        sessionToken={props.sessionToken}
        mode={props.mode}
        amountLabel={props.amountLabel}
        partnerName={props.partnerName}
        disableAutoRedirect={props.disableAutoRedirect}
      />
    );
  }

  if (!revealed || !stripePromise) {
    return (
      <RevealCTA
        mode={props.mode}
        amountLabel={props.amountLabel}
        onReveal={() => setRevealed(true)}
      />
    );
  }

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
      <StripeForm
        sessionToken={props.sessionToken}
        mode={props.mode}
        amountLabel={props.amountLabel}
        partnerName={props.partnerName}
        disableAutoRedirect={props.disableAutoRedirect}
      />
    </Elements>
  );
}
