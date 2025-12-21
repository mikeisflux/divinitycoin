// app/buy/page.tsx

'use client';

import { useState } from 'react';
import { AmountSelector } from '@/components/AmountSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function BuyPage() {
  const [amount, setAmount] = useState<number | null>(25);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!amount || !email) {
      setError('Please select an amount and enter your email.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Redirect to Stripe
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-neutral-900">Buy Credits</h1>
          <p className="mt-2 text-neutral-600">
            Choose your amount and receive your code instantly.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Amount Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Select Amount
              </label>
              <AmountSelector value={amount} onChange={setAmount} />
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
              <p className="mt-2 text-sm text-neutral-500">
                We'll send your credit code to this email.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Credits</span>
                <span className="font-semibold text-neutral-900">
                  ${amount?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-200">
                <span className="font-medium text-neutral-900">Total</span>
                <span className="font-bold text-xl text-neutral-900">
                  ${amount?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleCheckout}
              isLoading={isLoading}
              disabled={!amount || !email}
            >
              {isLoading ? 'Redirecting...' : 'Continue to Payment'}
            </Button>

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
                Secure Checkout
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

            {/* Legal */}
            <p className="text-xs text-neutral-500 text-center">
              By completing this purchase, you agree to our{' '}
              <a href="/terms" className="underline hover:text-neutral-700">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-neutral-700">
                Privacy Policy
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
