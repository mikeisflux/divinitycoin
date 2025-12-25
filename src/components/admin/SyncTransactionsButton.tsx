'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface SyncResult {
  transactionId: string;
  status: 'synced' | 'already_completed' | 'payment_not_succeeded' | 'error';
  stripeStatus?: string;
  error?: string;
}

interface SyncResponse {
  success: boolean;
  message: string;
  total?: number;
  synced?: number;
  failed?: number;
  results?: SyncResult[];
}

export function SyncTransactionsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    if (!confirm('This will sync all pending transactions with Stripe. Any completed payments will generate gift cards and send emails. Continue?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setResult(data);

      if (data.synced > 0) {
        // Refresh the page to show updated transactions
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to sync transactions',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSync}
          disabled={loading}
          isLoading={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Syncing...' : 'Sync with Stripe'}
        </Button>

        {result && (
          <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.message}
            {result.synced !== undefined && result.synced > 0 && (
              <span className="text-neutral-500"> (refreshing page...)</span>
            )}
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
                Total: {result.total} | Synced: {result.synced} | Failed: {result.failed}
              </div>
              {result.results.map((r) => (
                <div key={r.transactionId} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-neutral-600">{r.transactionId.slice(0, 8)}...</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.status === 'synced' ? 'bg-green-100 text-green-800' :
                    r.status === 'already_completed' ? 'bg-blue-100 text-blue-800' :
                    r.status === 'payment_not_succeeded' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.status === 'synced' ? 'Synced' :
                     r.status === 'already_completed' ? 'Already Completed' :
                     r.status === 'payment_not_succeeded' ? `Not Paid (${r.stripeStatus})` :
                     `Error: ${r.error}`}
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
