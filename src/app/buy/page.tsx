// app/buy/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AmountSelector } from '@/components/AmountSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StripeCheckout } from '@/components/checkout/StripeCheckout';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Partner {
  id: string;
  name: string;
  slug: string;
}

type CheckoutStep = 'select' | 'payment' | 'success';

interface SuccessData {
  giftCardId: string;
  code: string | null;
  codeLast4: string;
  amount: number;
  partnerId?: string;
  partnerSlug?: string;
  purchaseDate?: string;
}

// Partner redirect URLs for post-checkout
const PARTNER_REDIRECT_URLS: Record<string, string> = {
  'indiecrowdfund': 'https://indiecrowdfund.com/dashboard/backer',
};

export default function BuyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [amount, setAmount] = useState<number | null>(25);
  const [error, setError] = useState('');
  const [step, setStep] = useState<CheckoutStep>('select');
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Partner selection state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [loadingPartners, setLoadingPartners] = useState(true);

  // Resend code state
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

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
    fetchPartners();
  }, []);

  // Fetch available partners and detect referer for default selection
  async function fetchPartners() {
    try {
      const response = await fetch('/api/partners/public');
      if (response.ok) {
        const data = await response.json();
        // Add "Divinity Comics" as a static option if not already in the list
        const partnerList: Partner[] = data.partners || [];

        // Check if Divinity Comics exists, if not add it
        const hasDivinityComics = partnerList.some(p => p.slug === 'divinitycomics');
        if (!hasDivinityComics) {
          partnerList.push({
            id: 'divinitycomics',
            name: 'Divinity Comics',
            slug: 'divinitycomics',
          });
        }

        setPartners(partnerList);

        // Detect referer and set default partner
        const referer = typeof document !== 'undefined' ? document.referrer : '';
        let defaultPartnerId = '';

        // Check if referer is from indiecrowdfund
        if (referer.includes('indiecrowdfund.com')) {
          const indiecrowdfund = partnerList.find(p => p.slug === 'indiecrowdfund');
          if (indiecrowdfund) {
            defaultPartnerId = indiecrowdfund.id;
          }
        }

        // If no referer match, default to Indiecrowdfund
        if (!defaultPartnerId) {
          const indiecrowdfund = partnerList.find(p => p.slug === 'indiecrowdfund');
          if (indiecrowdfund) {
            defaultPartnerId = indiecrowdfund.id;
          } else if (partnerList.length > 0) {
            defaultPartnerId = partnerList[0].id;
          }
        }

        setSelectedPartnerId(defaultPartnerId);
      }
    } catch (err) {
      console.error('Failed to fetch partners:', err);
    } finally {
      setLoadingPartners(false);
    }
  }

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

  const handleProceedToPayment = () => {
    if (!user) {
      setError('Please sign in to continue.');
      return;
    }

    if (!amount) {
      setError('Please select an amount.');
      return;
    }

    if (!selectedPartnerId) {
      setError('Please select which partner sent you.');
      return;
    }

    setError('');
    setStep('payment');
  };

  const handlePaymentSuccess = (data: { giftCardId: string; code: string | null; codeLast4: string; amount: number }) => {
    const selectedPartner = partners.find(p => p.id === selectedPartnerId);
    setSuccessData({
      ...data,
      partnerId: selectedPartnerId,
      partnerSlug: selectedPartner?.slug,
      purchaseDate: new Date().toISOString(),
    });
    // Reset resend state for new purchase
    setResendSuccess(false);
    setResendError(null);
    setStep('success');
  };

  // Get redirect URL for the selected partner
  const getPartnerRedirectUrl = () => {
    if (successData?.partnerSlug) {
      return PARTNER_REDIRECT_URLS[successData.partnerSlug];
    }
    return null;
  };

  // Handle resend code request
  const handleResendCode = async () => {
    if (!successData?.giftCardId) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const response = await fetch(`/api/gift-cards/${successData.giftCardId}/resend`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setResendError(data.error || 'Failed to resend code');
        return;
      }

      setResendSuccess(true);
    } catch (err) {
      setResendError('An error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handlePaymentCancel = () => {
    setStep('select');
    setError('');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Success step
  if (step === 'success' && successData) {
    const partnerRedirectUrl = getPartnerRedirectUrl();
    const selectedPartner = partners.find(p => p.id === successData.partnerId);
    const purchaseDate = successData.purchaseDate
      ? new Date(successData.purchaseDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment Successful!</h1>
              <p className="text-neutral-600 mb-4">
                {successData.code
                  ? 'Here is your credit code. Save it now!'
                  : 'Your purchase has been confirmed.'}
              </p>

              {/* Code Display Box */}
              {successData.code ? (
                <>
                  <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-6 mb-6">
                    <p className="text-xs text-primary-600 uppercase tracking-wider mb-2 font-semibold">Your Credit Code</p>
                    <p className="font-mono text-2xl sm:text-3xl font-bold text-primary-700 tracking-wider break-all select-all">
                      {successData.code}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(successData.code!);
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy to Clipboard
                    </button>
                  </div>

                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                    <strong>Important:</strong> Save this code now. It will also be sent to {user?.email}.
                  </p>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-800 mb-2">
                    <strong>Code Reference:</strong> ****{successData.codeLast4}
                  </p>
                  <p className="text-sm text-amber-700">
                    Your code has been sent to <strong>{user?.email}</strong>. Please check your email (including spam folder) for the full code.
                  </p>
                </div>
              )}

              {/* Receipt / Order Details */}
              <div className="bg-neutral-50 rounded-lg p-6 mb-6 text-left">
                <h3 className="text-sm font-semibold text-neutral-700 mb-4 text-center">Order Receipt</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Amount</span>
                    <span className="text-lg font-bold text-primary-600">${successData.amount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Order ID</span>
                    <span className="font-mono text-xs text-neutral-600">{successData.giftCardId.slice(0, 8)}...</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Date</span>
                    <span className="text-sm text-neutral-900">{purchaseDate}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Email</span>
                    <span className="text-sm text-neutral-900">{user?.email}</span>
                  </div>

                  {selectedPartner && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-500">Partner</span>
                      <span className="text-sm text-neutral-900">{selectedPartner.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-neutral-500 mb-4">
                Use this code on any partner platform to redeem your credits.
              </p>

              {/* Resend Code Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 mb-3">
                  Need a backup? Request the code to be sent to your email.
                </p>

                {resendSuccess && (
                  <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm mb-3">
                    Request submitted! Please check your email and spam folder.
                  </div>
                )}

                {resendError && (
                  <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm mb-3">
                    {resendError}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendCode}
                  disabled={resending || resendSuccess}
                  className="w-full"
                >
                  {resending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : resendSuccess ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Request Sent
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Resend Code to Email
                    </>
                  )}
                </Button>
              </div>

              {/* Partner-specific redirect section */}
              {partnerRedirectUrl && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-primary-800 mb-3">
                    Return to your backer dashboard to redeem your code
                  </p>
                  <a
                    href={partnerRedirectUrl}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors w-full"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Go to {selectedPartner?.name || 'Partner'} Dashboard
                  </a>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button onClick={() => { setStep('select'); setSuccessData(null); }} variant={partnerRedirectUrl ? 'outline' : 'default'}>
                  Buy More Credits
                </Button>
                <Link href="/account" className="text-primary-600 hover:underline text-sm">
                  View My Account
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Payment step
  if (step === 'payment' && user && amount) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-900">Complete Payment</h1>
            <p className="mt-2 text-neutral-600">
              Enter your payment details to complete your purchase.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <StripeCheckout
                amount={amount}
                email={user.email}
                partnerId={selectedPartnerId}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Select amount step (default)
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
                    placeholder="********"
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
                      placeholder="********"
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

            {/* Partner Selection Dropdown */}
            {user && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Which one of our partners did you get sent from? <span className="text-red-500">*</span>
                </label>
                {loadingPartners ? (
                  <div className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 bg-neutral-50 text-neutral-400">
                    Loading partners...
                  </div>
                ) : (
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors bg-white"
                  >
                    <option value="">Select a partner...</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-2 text-sm text-neutral-500">
                  Let us know which platform referred you to us.
                </p>
              </div>
            )}

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
              onClick={handleProceedToPayment}
              disabled={!amount || !user}
            >
              {user ? 'Continue to Payment' : 'Sign In to Continue'}
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
