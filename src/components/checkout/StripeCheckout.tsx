'use client';

import { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';

interface CheckoutFormProps {
  amount: number;
  transactionId: string;
  onSuccess: (data: { giftCardId: string; codeLast4: string; amount: number }) => void;
  onError: (error: string) => void;
}

function CheckoutForm({ amount, transactionId, onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'An error occurred');
        onError(error.message || 'Payment failed');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment and generate gift card
        const confirmResponse = await fetch('/api/payment-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            transactionId: transactionId,
          }),
        });

        const confirmData = await confirmResponse.json();

        if (!confirmResponse.ok) {
          setMessage(confirmData.error || 'Failed to confirm payment');
          onError(confirmData.error || 'Failed to confirm payment');
          setIsProcessing(false);
          return;
        }

        onSuccess({
          giftCardId: confirmData.giftCardId,
          codeLast4: confirmData.codeLast4,
          amount: confirmData.amount,
        });
      } else {
        setMessage('Payment was not completed. Please try again.');
        onError('Payment was not completed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setMessage(errorMessage);
      onError(errorMessage);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {message && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripe || isProcessing}
        isLoading={isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </Button>
    </form>
  );
}

interface StripeCheckoutProps {
  amount: number;
  email: string;
  partnerId?: string;
  onSuccess: (data: { giftCardId: string; codeLast4: string; amount: number }) => void;
  onCancel: () => void;
}

export function StripeCheckout({ amount, email, partnerId, onSuccess, onCancel }: StripeCheckoutProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load Stripe publishable key
    fetch('/api/stripe-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey));
        } else {
          setError('Payment system is not configured');
        }
      })
      .catch(() => {
        setError('Failed to load payment configuration');
      });
  }, []);

  useEffect(() => {
    if (!stripePromise) return;

    // Create PaymentIntent
    fetch('/api/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, email, partnerId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setTransactionId(data.transactionId);
        } else {
          setError(data.error || 'Failed to initialize payment');
        }
      })
      .catch(() => {
        setError('Failed to initialize payment');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stripePromise, amount, email, partnerId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
        <p className="text-neutral-500">Preparing checkout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!clientSecret || !stripePromise || !transactionId) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500">Failed to load checkout. Please try again.</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="bg-neutral-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-neutral-600">DivinityCoin Credits</span>
          <span className="font-semibold text-neutral-900">
            ${amount.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-200">
          <span className="font-medium text-neutral-900">Total</span>
          <span className="font-bold text-xl text-neutral-900">
            ${amount.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Code will be sent to: {email}
        </p>
      </div>

      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
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
        <CheckoutForm
          amount={amount}
          transactionId={transactionId}
          onSuccess={onSuccess}
          onError={setError}
        />
      </Elements>

      <div className="text-center">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-neutral-500 hover:text-neutral-700 underline"
        >
          Cancel and go back
        </button>
      </div>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-100">
        <div className="flex items-center gap-2 text-neutral-400 text-sm">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Secure Payment
        </div>
        <div className="flex items-center gap-2 text-neutral-400 text-sm">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          Powered by Stripe
        </div>
      </div>
    </div>
  );
}
