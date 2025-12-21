'use client';

// app/admin/settlements/[id]/SettlementActions.tsx
// Client component for settlement action buttons

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettlementStatus } from '@prisma/client';

interface SettlementActionsProps {
  settlementId: string;
  status: SettlementStatus;
  netAmount: number;
  paymentMethod?: string | null;
  paymentRef?: string | null;
}

export function SettlementActions({
  settlementId,
  status,
  netAmount,
  paymentMethod,
  paymentRef: existingPaymentRef,
}: SettlementActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState(existingPaymentRef || '');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleAction = async (action: string, data?: Record<string, string>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/settlements/${settlementId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Action failed');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="font-semibold text-neutral-900 mb-4">Actions</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* PENDING -> APPROVED */}
        {status === SettlementStatus.PENDING && (
          <>
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Approve Settlement'}
            </button>
            <button
              onClick={() => setShowDisputeModal(true)}
              disabled={loading}
              className="w-full px-4 py-2 border border-orange-300 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-50 transition disabled:opacity-50"
            >
              Dispute
            </button>
          </>
        )}

        {/* APPROVED -> PROCESSING */}
        {status === SettlementStatus.APPROVED && (
          <div className="space-y-3">
            <div className="bg-neutral-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-neutral-900 mb-2">Amount to Send</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(netAmount)}</p>
              <p className="text-sm text-neutral-500 mt-1">{paymentMethod || 'Wire Transfer'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Payment Reference
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="WIRE-20250108-001"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <button
              onClick={() => handleAction('process', { paymentRef })}
              disabled={loading || !paymentRef}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Mark as Processing'}
            </button>
          </div>
        )}

        {/* PROCESSING -> PAID or FAILED */}
        {status === SettlementStatus.PROCESSING && (
          <>
            <div className="bg-purple-50 p-4 rounded-lg mb-3">
              <p className="text-sm text-purple-800">
                Payment initiated. Confirm once the transfer is complete.
              </p>
              {existingPaymentRef && (
                <p className="text-sm font-mono mt-2">Ref: {existingPaymentRef}</p>
              )}
            </div>

            <button
              onClick={() => handleAction('paid')}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Mark as Paid'}
            </button>

            <button
              onClick={() => handleAction('failed', { reason: 'Payment failed' })}
              disabled={loading}
              className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
            >
              Mark as Failed
            </button>
          </>
        )}

        {/* PAID - Show success */}
        {status === SettlementStatus.PAID && (
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-green-800">Settlement Paid</p>
            <p className="text-sm text-green-600 mt-1">{formatCurrency(netAmount)}</p>
          </div>
        )}

        {/* FAILED - Retry options */}
        {status === SettlementStatus.FAILED && (
          <>
            <div className="bg-red-50 p-4 rounded-lg mb-3">
              <p className="text-sm text-red-800">
                Payment failed. You can retry the payment process.
              </p>
            </div>

            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Retry - Move to Approved'}
            </button>
          </>
        )}

        {/* DISPUTED */}
        {status === SettlementStatus.DISPUTED && (
          <>
            <div className="bg-orange-50 p-4 rounded-lg mb-3">
              <p className="text-sm text-orange-800">
                This settlement is under dispute. Resolve the dispute to proceed.
              </p>
            </div>

            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Resolve & Approve'}
            </button>
          </>
        )}
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Dispute Settlement</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Reason for Dispute
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Explain why this settlement is being disputed..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction('dispute', { reason: disputeReason });
                  setShowDisputeModal(false);
                }}
                disabled={!disputeReason}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
