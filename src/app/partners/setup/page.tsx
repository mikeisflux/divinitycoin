// app/partners/setup/page.tsx
// Partner password setup page (first-time login)

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PartnerSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; email: string } | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid setup link. Please contact support.');
      setLoading(false);
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/partners/setup/verify?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setPartnerInfo(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid or expired setup link');
      }
    } catch (err) {
      setError('Failed to verify setup link');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Password strength check
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasLowercase = /[a-z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError('Password must include uppercase, lowercase, and numbers');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/partners/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      if (response.ok) {
        // Redirect to login
        router.push('/partners/login?setup=complete');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to set up account');
      }
    } catch (err) {
      setError('Failed to set up account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !partnerInfo) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 mb-2">Setup Link Invalid</h1>
          <p className="text-neutral-600 mb-6">{error}</p>
          <Link
            href="/partners/login"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Set Up Your Account</h1>
          <p className="text-neutral-600 mt-2">
            Welcome, <strong>{partnerInfo?.name}</strong>! Create a password to access your partner dashboard.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={partnerInfo?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Create a strong password"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            />
            <p className="text-xs text-neutral-500 mt-1">
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm your password"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Setting Up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
