'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface LinkResponse {
  success: boolean;
  message?: string;
  error?: string;
  linkedGiftCards?: number;
  linkedTransactions?: number;
  totalUnlinkedGiftCards?: number;
  totalUnlinkedTransactions?: number;
}

export function LinkPurchasesButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkResponse | null>(null);

  const handleLink = async () => {
    if (!confirm('This will link guest purchases to existing user accounts by matching email addresses. Continue?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/users/link-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: 'Failed to link purchases',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button
        onClick={handleLink}
        disabled={loading}
        isLoading={loading}
        variant="outline"
        className="flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        {loading ? 'Linking...' : 'Link Purchases'}
      </Button>

      {result && (
        <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.success ? result.message : result.error}
        </div>
      )}
    </div>
  );
}
