// app/checkout/[sessionToken]/page.tsx
// Public DC-hosted checkout page. Renders DC chrome around Stripe
// Elements when the session is still pending; renders a terminal
// state with auto-redirect to the partner's returnUrl otherwise.

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';
import { getStripeConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { fireCheckoutWebhookIfNeeded } from '@/lib/checkout/webhook';
import { HostedCheckoutForm } from './HostedCheckoutForm';
import { TerminalRedirect } from './TerminalRedirect';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Checkout - Divinity Payments',
  robots: 'noindex, nofollow',
};

type Status = 'PENDING' | 'COMPLETE' | 'FAILED' | 'EXPIRED' | 'CANCELED';

async function loadSession(sessionToken: string) {
  const session = await prisma.checkoutSession.findUnique({
    where: { sessionToken },
  });
  if (!session) return null;

  let status = session.status as Status;

  // Lazy-expire on read.
  if (status === 'PENDING' && session.expiresAt < new Date()) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    status = 'EXPIRED';
    await fireCheckoutWebhookIfNeeded(session.id);
  }

  // Self-heal: if PENDING in our DB but the underlying intent has
  // already completed at the processor (e.g., webhook hasn't landed
  // yet), trust live status. Handles both PaymentIntent (PAYMENT mode)
  // and SetupIntent (SETUP mode).
  if (status === 'PENDING') {
    try {
      const stripe = await getStripeClient();
      let transitioned = false;
      if (session.paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(session.paymentIntentId);
        if (pi.status === 'succeeded') {
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
              status: 'COMPLETE',
              completedAt: new Date(),
              paymentMethodId: typeof pi.payment_method === 'string' ? pi.payment_method : null,
            },
          });
          status = 'COMPLETE';
          transitioned = true;
        } else if (pi.status === 'canceled') {
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: { status: 'CANCELED' },
          });
          status = 'CANCELED';
          transitioned = true;
        }
      } else if (session.setupIntentId) {
        const si = await stripe.setupIntents.retrieve(session.setupIntentId);
        if (si.status === 'succeeded') {
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
              status: 'COMPLETE',
              completedAt: new Date(),
              paymentMethodId: typeof si.payment_method === 'string' ? si.payment_method : null,
            },
          });
          status = 'COMPLETE';
          transitioned = true;
        } else if (si.status === 'canceled') {
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: { status: 'CANCELED' },
          });
          status = 'CANCELED';
          transitioned = true;
        }
      }
      if (transitioned) {
        await fireCheckoutWebhookIfNeeded(session.id);
      }
    } catch (error) {
      logger.error('Hosted checkout: failed to refresh session from processor', {
        sessionId: session.sessionToken,
        error,
      });
    }
  }

  return { session, status };
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

function CheckoutShell({
  session,
  children,
}: {
  session: { partnerName: string | null; partnerLogoUrl: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">D</span>
          </div>
          <span className="font-semibold text-neutral-900">
            Divinity <span className="text-primary-600">Payments</span>
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Partner branding */}
          <div className="flex items-center gap-3 mb-6">
            {session.partnerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.partnerLogoUrl}
                alt=""
                className="w-10 h-10 rounded-lg object-cover bg-white border border-neutral-200"
              />
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Pay</p>
              <p className="font-semibold text-neutral-900">
                {session.partnerName ?? 'Partner'}
              </p>
            </div>
          </div>

          {children}

          <p className="text-center text-xs text-neutral-400 mt-8">
            Secure payment by Divinity Payments
          </p>
        </div>
      </main>
    </div>
  );
}

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export default async function HostedCheckoutPage({
  params,
}: {
  params: { sessionToken: string };
}) {
  const data = await loadSession(params.sessionToken);
  if (!data) notFound();

  const { session, status } = data;

  // Terminal states: render a small status card and auto-redirect to the
  // partner's returnUrl (or cancelUrl on cancel/expired).
  if (status !== 'PENDING') {
    const isSuccess = status === 'COMPLETE';
    const target =
      isSuccess
        ? session.returnUrl
        : (session.cancelUrl ?? session.returnUrl);
    const redirectTo = target ? appendSessionId(target, session.sessionToken) : null;

    const heading =
      status === 'COMPLETE' ? 'Payment complete' :
      status === 'FAILED'   ? 'Payment failed' :
      status === 'EXPIRED'  ? 'Checkout expired' :
                              'Checkout canceled';

    const body =
      status === 'COMPLETE' ? `You'll be returned to ${session.partnerName ?? 'the partner site'} in a moment.` :
      status === 'FAILED'   ? 'Your payment could not be completed.' :
      status === 'EXPIRED'  ? 'This checkout link is no longer valid.' :
                              'No charge was made.';

    return (
      <CheckoutShell session={session}>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
          <div
            className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isSuccess ? 'bg-green-100' : 'bg-neutral-100'
            }`}
          >
            {isSuccess ? (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">{heading}</h1>
          <p className="text-sm text-neutral-600 mt-1">{body}</p>
          {redirectTo && (
            <a
              href={redirectTo}
              className="inline-block mt-4 text-sm text-primary-600 hover:underline"
            >
              Return to {session.partnerName ?? 'partner site'} now
            </a>
          )}
        </div>
        {redirectTo && <TerminalRedirect url={redirectTo} delayMs={2000} />}
      </CheckoutShell>
    );
  }

  // PENDING — render the checkout form. Pull a fresh client_secret from
  // the processor so a stale session doesn't ship a dead secret.
  const stripe = await getStripeClient();
  const stripeConfig = await getStripeConfig();
  const isSetup = session.mode === 'SETUP';

  if (isSetup ? !session.setupIntentId : !session.paymentIntentId) {
    notFound();
  }

  let clientSecret: string;
  try {
    if (isSetup) {
      const si = await stripe.setupIntents.retrieve(session.setupIntentId!);
      if (!si.client_secret) throw new Error('SetupIntent missing client_secret');
      clientSecret = si.client_secret;
    } else {
      const pi = await stripe.paymentIntents.retrieve(session.paymentIntentId!);
      if (!pi.client_secret) throw new Error('PaymentIntent missing client_secret');
      clientSecret = pi.client_secret;
    }
  } catch (error) {
    logger.error('Hosted checkout: failed to retrieve intent', {
      sessionId: session.sessionToken,
      mode: session.mode,
      error,
    });
    return (
      <CheckoutShell session={session}>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">Checkout unavailable</h1>
          <p className="text-sm text-neutral-600 mt-2">
            We couldn't load this {isSetup ? 'card setup' : 'payment'}. Please return to{' '}
            {session.partnerName ?? 'the partner site'} and try again.
          </p>
        </div>
      </CheckoutShell>
    );
  }

  const amountLabel = isSetup ? null : formatAmount(session.amount ?? 0, session.currency);

  return (
    <CheckoutShell session={session}>
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="mb-6">
          {isSetup ? (
            <>
              <p className="text-sm text-neutral-500">Save card on file</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">
                No charge today
              </p>
              <p className="text-sm text-neutral-600 mt-1">
                {session.partnerName ?? 'The partner'} will use this card for future pledges.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500">Total due</p>
              <p className="text-3xl font-bold text-neutral-900 mt-1">{amountLabel}</p>
            </>
          )}
          {session.description && (
            <p className="text-sm text-neutral-600 mt-2">{session.description}</p>
          )}
        </div>

        <HostedCheckoutForm
          sessionToken={session.sessionToken}
          publishableKey={stripeConfig.publishableKey}
          clientSecret={clientSecret}
          mode={isSetup ? 'setup' : 'payment'}
          amountLabel={amountLabel}
          partnerName={session.partnerName ?? null}
          returnUrl={session.returnUrl ?? null}
          cancelUrl={session.cancelUrl ?? null}
          disableAutoRedirect={session.disableAutoRedirect}
        />
      </div>
    </CheckoutShell>
  );
}
