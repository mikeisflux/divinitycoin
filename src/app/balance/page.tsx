// app/balance/page.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface CheckResult {
  valid?: boolean;
  amount?: number;
  status?: string;
  statusMessage?: string;
  codeLast4?: string;
  expiresAt?: string | null;
  error?: string;
}

export default function BalancePage() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const formatCode = (value: string) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const parts = clean.match(/.{1,4}/g) || [];
    return parts.join('-').substring(0, 19);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(formatCode(e.target.value));
  };

  const handleCheck = async () => {
    if (!code.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/cards/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error || 'Failed to check balance' });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ error: 'Failed to check balance. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'REDEEMED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'EXPIRED':
      case 'REVOKED':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-neutral-50 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-neutral-900">Check Balance</h1>
          <p className="mt-2 text-neutral-600">
            Enter your code to check its status and value.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Code Input */}
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Credit Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors font-mono text-center text-lg tracking-wider"
                maxLength={19}
              />
            </div>

            {/* Check Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleCheck}
              isLoading={isLoading}
              disabled={!code.trim() || code.replace(/-/g, '').length < 16}
            >
              {isLoading ? 'Checking...' : 'Check Balance'}
            </Button>

            {/* Result */}
            {result && (
              <div
                className={`rounded-lg p-6 border ${
                  result.error
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : getStatusColor(result.status)
                }`}
              >
                {result.error ? (
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p>{result.error}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Amount */}
                    <div className="text-center">
                      <p className="text-sm opacity-75 mb-1">
                        {result.valid ? 'Available Balance' : 'Original Value'}
                      </p>
                      <p className="text-4xl font-bold">${result.amount?.toFixed(2)}</p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        result.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        result.status === 'REDEEMED' ? 'bg-blue-100 text-blue-700' :
                        result.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {result.status === 'ACTIVE' && (
                          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {result.status}
                      </span>
                    </div>

                    {/* Status Message */}
                    <p className="text-center text-sm opacity-75">
                      {result.statusMessage}
                    </p>

                    {/* Expiry Info */}
                    {result.expiresAt && result.status === 'ACTIVE' && (
                      <p className="text-center text-sm opacity-75">
                        Valid until {formatDate(result.expiresAt)}
                      </p>
                    )}

                    {/* Card Last 4 */}
                    <p className="text-center text-xs opacity-50 font-mono">
                      Card ending in {result.codeLast4}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="text-sm text-neutral-500 text-center">
              <p>
                Your credit code was sent to your email after purchase. Check
                your inbox or spam folder.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help */}
        <p className="mt-8 text-sm text-neutral-500 text-center">
          Having trouble?{' '}
          <a href="/support" className="text-primary-600 hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
