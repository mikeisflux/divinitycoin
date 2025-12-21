'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SettlementStatus } from '@prisma/client';

interface SettlementActionsProps {
  settlementId: string;
  status: SettlementStatus;
}

export function SettlementActions({ settlementId, status }: SettlementActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const handleAction = async (action: string, body?: object) => {
    setLoading(action);
    setError(null);

    try {
      const response = await fetch(`/api/admin/settlements/${settlementId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {status === 'PENDING' && (
          <>
            <Button
              onClick={() => handleAction('approve')}
              disabled={loading !== null}
            >
              {loading === 'approve' ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDispute(true)}
              disabled={loading !== null}
            >
              Dispute
            </Button>
          </>
        )}

        {status === 'APPROVED' && (
          <>
            <Button
              onClick={() => handleAction('process')}
              disabled={loading !== null}
            >
              {loading === 'process' ? 'Processing...' : 'Mark Processing'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDispute(true)}
              disabled={loading !== null}
            >
              Dispute
            </Button>
          </>
        )}

        {status === 'PROCESSING' && (
          <>
            <Button
              onClick={() => setShowPaid(true)}
              disabled={loading !== null}
            >
              Mark as Paid
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('failed')}
              disabled={loading !== null}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {loading === 'failed' ? 'Processing...' : 'Mark Failed'}
            </Button>
          </>
        )}

        {status === 'FAILED' && (
          <Button
            variant="outline"
            onClick={() => handleAction('process')}
            disabled={loading !== null}
          >
            {loading === 'process' ? 'Processing...' : 'Retry Payment'}
          </Button>
        )}
      </div>

      {/* Dispute Modal */}
      {showDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Dispute Settlement</h3>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Enter dispute reason..."
              className="w-full h-32 p-3 border border-neutral-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowDispute(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleAction('dispute', { reason: disputeReason });
                  setShowDispute(false);
                }}
                disabled={!disputeReason.trim()}
              >
                Submit Dispute
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Paid Modal */}
      {showPaid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mark as Paid</h3>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Payment Reference
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Wire reference, PayPal ID, etc."
              className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowPaid(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleAction('paid', { paymentRef });
                  setShowPaid(false);
                }}
                disabled={!paymentRef.trim()}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
