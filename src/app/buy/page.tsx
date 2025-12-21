// app/buy/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AmountSelector } from '@/components/AmountSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface User {
  id: string;
  email: string;
  name: string | null;
}

export default function BuyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [amount, setAmount] = useState<number | null>(25);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth form state (for inline login/register)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setCheckingAuth(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        if (authData.password !== authData.confirmPassword) {
          setAuthError('Passwords do not match');
          setAuthLoading(false);
          return;
        }
        if (authData.password.length < 8) {
          setAuthError('Password must be at least 8 characters');
          setAuthLoading(false);
          return;
        }
      }

      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authData.email,
          password: authData.password,
          name: authData.name || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setUser(data.user);
    } catch (err) {
      setAuthError('An error occurred. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  const handleCheckout = async () => {
    if (!user) {
      setError('Please sign in to continue.');
      return;
    }

    if (!amount) {
      setError('Please select an amount.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email: user.email }),
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

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

        {/* Not logged in - show auth form */}
        {!user && (
          <Card className="shadow-lg mb-8">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">
                {authMode === 'login' ? 'Sign In to Continue' : 'Create Account'}
              </CardTitle>
              <p className="text-neutral-500 text-sm mt-1">
                {authMode === 'login'
                  ? 'Sign in to purchase credits and track your orders'
                  : 'Create an account to get started'}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
                      Name (optional)
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={authData.name}
                      onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-sm font-medium text-neutral-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="auth-email"
                    required
                    value={authData.email}
                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-sm font-medium text-neutral-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="auth-password"
                    required
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {authMode === 'register' && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-neutral-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="auth-confirm-password"
                      required
                      value={authData.confirmPassword}
                      onChange={(e) => setAuthData({ ...authData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                {authError && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading
                    ? 'Please wait...'
                    : authMode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                {authMode === 'login' ? (
                  <p className="text-sm text-neutral-600">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                      }}
                      className="text-primary-600 hover:underline font-medium"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-neutral-600">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                      }}
                      className="text-primary-600 hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logged in user info */}
        {user && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-900">Signed in as</p>
                <p className="text-sm text-green-700">{user.email}</p>
              </div>
            </div>
            <Link href="/account" className="text-sm text-green-700 hover:underline">
              My Account
            </Link>
          </div>
        )}

        <Card className="shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Amount Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Select Amount
              </label>
              <AmountSelector value={amount} onChange={setAmount} />
            </div>

            {/* Email display for logged in users */}
            {user && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Delivery Email
                </label>
                <div className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 bg-neutral-50 text-neutral-600">
                  {user.email}
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  We&apos;ll send your credit code to this email.
                </p>
              </div>
            )}

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
              disabled={!amount || !user}
            >
              {isLoading ? 'Redirecting...' : user ? 'Continue to Payment' : 'Sign In to Continue'}
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
