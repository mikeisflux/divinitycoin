// app/balance/page.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function BalancePage() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    valid?: boolean;
    amount?: number;
    status?: string;
    error?: string;
  } | null>(null);

  const handleCheck = async () => {
    if (!code.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      // This would call an API endpoint to check the code status
      // For now, show a placeholder response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate response
      setResult({
        error:
          'Balance checking is not available yet. Please redeem your code on a partner platform.',
      });
    } catch {
      setResult({ error: 'Failed to check balance. Please try again.' });
    } finally {
      setIsLoading(false);
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
                onChange={(e) => setCode(e.target.value.toUpperCase())}
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
              disabled={!code.trim()}
            >
              {isLoading ? 'Checking...' : 'Check Balance'}
            </Button>

            {/* Result */}
            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.valid
                    ? 'bg-green-50 text-green-800'
                    : result.error
                    ? 'bg-red-50 text-red-800'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {result.valid ? (
                  <div className="text-center">
                    <p className="text-sm mb-2">Available Balance</p>
                    <p className="text-3xl font-bold">${result.amount?.toFixed(2)}</p>
                    <p className="text-sm mt-2">Status: {result.status}</p>
                  </div>
                ) : (
                  <p>{result.error}</p>
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
