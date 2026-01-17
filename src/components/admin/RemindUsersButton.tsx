'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface RemindResult {
  cardId: string;
  email: string;
  status: 'sent' | 'failed' | 'no_email';
  error?: string;
}

interface RemindResponse {
  success: boolean;
  message: string;
  total?: number;
  sent?: number;
  failed?: number;
  results?: RemindResult[];
}

export function RemindUsersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemindResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleRemind = async () => {
    if (!confirm('This will send reminder emails to all users with unredeemed gift cards. Continue?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/transactions/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        message: 'Failed to send reminder emails',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleRemind}
          disabled={loading}
          isLoading={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {loading ? 'Sending...' : 'Remind Users'}
        </Button>

        {result && (
          <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.message}
          </div>
        )}
      </div>

      {result?.results && result.results.length > 0 && (
        <div className="bg-neutral-50 rounded-lg p-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
          >
            {showDetails ? 'Hide' : 'Show'} Details
            <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-neutral-500 mb-2">
                Total: {result.total} | Sent: {result.sent} | Failed: {result.failed}
              </div>
              {result.results.map((r) => (
                <div key={r.cardId} className="flex items-center gap-2 text-sm">
                  <span className="text-neutral-600 truncate max-w-[200px]">{r.email}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.status === 'sent' ? 'bg-green-100 text-green-800' :
                    r.status === 'no_email' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.status === 'sent' ? 'Sent' :
                     r.status === 'no_email' ? 'No Email' :
                     `Failed: ${r.error}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
