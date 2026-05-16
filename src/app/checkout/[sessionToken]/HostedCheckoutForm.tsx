'use client';

// app/checkout/[sessionToken]/HostedCheckoutForm.tsx
// Stripe Elements form mounted inside the DC-hosted checkout page.
// On success it pings our /api/checkout/[token]/complete endpoint
// (which authoritatively verifies the PI status with the processor
// before marking the session COMPLETE) and then redirects to the
// partner's returnUrl with ?session_id=...

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
}

function appendSessionId(url: string, sessionToken: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('session_id', sessionToken);
    return u.toString();
  } catch {
    return url;
  }
}

function InnerForm({
  sessionToken,
  mode,
  amountLabel,
  partnerName,
  returnUrl,
  cancelUrl,
}: Pick<Props, 'sessionToken' | 'mode' | 'amountLabel' | 'partnerName' | 'returnUrl' | 'cancelUrl'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [walletsReady, setWalletsReady] = useState(false);

  // The same hosted-checkout page is the return target for any 3DS
  // redirect (both payment and setup flows). Detect post-redirect
  // arrival via either Stripe-supplied URL param and finalize.
  useEffect(() => {
    if (typeof window === 'undefined' || !stripe) return;
    const url = new URL(window.location.href);
    const piSecret = url.searchParams.get('payment_intent_client_secret');
    const siSecret = url.searchParams.get('setup_intent_client_secret');
    if (!piSecret && !siSecret) return;

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
        setError(body?.error || (mode === 'payment' ? 'Could not finalize payment' : 'Could not finalize card setup'));
        return;
      }
      setDone(true);
      const target = body.redirectUrl as string | null;
      if (target) {
        window.location.replace(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize');
    }
  }

  // Confirms via the appropriate processor API for the session's mode
  // and returns a structured result. Used by both the card form submit
  // and the ExpressCheckoutElement (Apple Pay / Google Pay / Link) path.
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

  return (
    <div className="space-y-5">
      {/* Wallet buttons (Apple Pay / Google Pay / Link). Renders nothing
          if no wallet is available on the user's browser. */}
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
      />
    </Elements>
  );
}
