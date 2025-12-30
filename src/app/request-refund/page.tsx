// app/request-refund/page.tsx
// User refund request page

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface EligibleTransaction {
  id: string;
  amount: number;
  createdAt: string;
  giftCard: {
    id: string;
    codeLast4: string;
    status: string;
    redeemedAt: string | null;
    redeemedOnPlatform: string | null;
  } | null;
}

interface RefundRequest {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  reason: string | null;
  partnerName: string | null;
  createdAt: string;
  processedAt: string | null;
  failureReason: string | null;
}

const REFUND_REASONS = [
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'duplicate_purchase', label: 'Duplicate purchase' },
  { value: 'wrong_amount', label: 'Purchased wrong amount' },
  { value: 'technical_issue', label: 'Technical issue with purchase' },
  { value: 'other', label: 'Other reason' },
];

export default function RequestRefundPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligibleTransactions, setEligibleTransactions] = useState<EligibleTransaction[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<string>('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await fetch('/api/refund-request');

      if (response.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setIsAuthenticated(true);
      setEligibleTransactions(data.eligibleTransactions || []);
      setRefundRequests(data.refundRequests || []);
    } catch (err) {
      console.error('Failed to fetch refund data:', err);
      setError('Failed to load refund information');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedTransaction) {
      setError('Please select a transaction');
      return;
    }

    const finalReason = reason === 'other' ? customReason : REFUND_REASONS.find(r => r.value === reason)?.label;

    setSubmitting(true);

    try {
      const response = await fetch('/api/refund-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction,
          reason: finalReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit refund request');
        return;
      }

      setSuccess(data.message || 'Refund request submitted successfully');
      setSelectedTransaction('');
      setReason('');
      setCustomReason('');

      // Refresh data
      await fetchData();
    } catch (err) {
      setError('Failed to submit refund request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      AWAITING_PARTNER: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      REJECTED: 'bg-red-100 text-red-800',
    };

    const labels: Record<string, string> = {
      PENDING: 'Pending Review',
      AWAITING_PARTNER: 'Processing with Partner',
      APPROVED: 'Approved',
      PROCESSING: 'Processing',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      REJECTED: 'Rejected',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-neutral-50 py-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
        <Footer />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-neutral-50 py-24">
          <div className="max-w-md mx-auto px-4 text-center">
            <Card>
              <CardContent className="py-12">
                <h1 className="text-2xl font-bold text-neutral-900 mb-4">Sign In Required</h1>
                <p className="text-neutral-600 mb-6">
                  Please sign in to your account to request a refund.
                </p>
                <Link href="/account">
                  <Button>Sign In</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900">Request a Refund</h1>
            <p className="text-neutral-600 mt-2">
              Request a refund for purchases made within the last 30 days.
            </p>
          </div>

          {/* Refund Policy Notice */}
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Important - Full Refunds Only:</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li><strong>We only issue full refunds</strong> - partial refunds are not available</li>
                    <li>Unredeemed codes are eligible for a full refund within 30 days</li>
                    <li>Redeemed codes require the <strong>full balance to be unused</strong> on the partner platform</li>
                    <li>If you have spent any of your redeemed balance, a refund cannot be processed</li>
                    <li>Refunds are processed to your original payment method in 5-10 business days</li>
                  </ul>
                  <Link href="/refunds" className="inline-block mt-2 text-amber-900 underline hover:no-underline">
                    View full refund policy
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refund Request Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>New Refund Request</CardTitle>
            </CardHeader>
            <CardContent>
              {eligibleTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-500 mb-4">
                    No eligible purchases found for refund.
                  </p>
                  <p className="text-sm text-neutral-400">
                    Purchases must be within 30 days and not already refunded or have a pending request.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Transaction Selection */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-3">
                      Select Purchase to Refund
                    </label>
                    <div className="space-y-3">
                      {eligibleTransactions.map((transaction) => (
                        <label
                          key={transaction.id}
                          className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedTransaction === transaction.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="transaction"
                            value={transaction.id}
                            checked={selectedTransaction === transaction.id}
                            onChange={(e) => setSelectedTransaction(e.target.value)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-neutral-900">
                                ${transaction.amount.toFixed(2)}
                              </span>
                              <span className="text-sm text-neutral-500">
                                {formatDate(transaction.createdAt)}
                              </span>
                            </div>
                            {transaction.giftCard && (
                              <div className="mt-1 text-sm text-neutral-500">
                                Code: ****{transaction.giftCard.codeLast4}
                                {transaction.giftCard.status === 'REDEEMED' && (
                                  <span className="ml-2 text-amber-600">
                                    (Redeemed{transaction.giftCard.redeemedOnPlatform ? ` on ${transaction.giftCard.redeemedOnPlatform}` : ''})
                                  </span>
                                )}
                                {transaction.giftCard.status === 'ACTIVE' && (
                                  <span className="ml-2 text-green-600">(Unused)</span>
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Reason Selection */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Reason for Refund
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                      <option value="">Select a reason...</option>
                      {REFUND_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Reason */}
                  {reason === 'other' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Please explain
                      </label>
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Please provide details about your refund request..."
                      />
                    </div>
                  )}

                  {/* Error/Success Messages */}
                  {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
                      {success}
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submitting || !selectedTransaction}
                    className="w-full"
                  >
                    {submitting ? 'Submitting...' : 'Submit Refund Request'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Previous Refund Requests */}
          {refundRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Refund Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Date</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Amount</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundRequests.map((req) => (
                        <tr key={req.id} className="border-b border-neutral-100">
                          <td className="py-3 px-2 text-sm text-neutral-900">
                            {formatDate(req.createdAt)}
                          </td>
                          <td className="py-3 px-2 text-sm font-medium text-neutral-900">
                            ${Number(req.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-2">
                            {getStatusBadge(req.status)}
                          </td>
                          <td className="py-3 px-2 text-sm text-neutral-500">
                            {req.status === 'FAILED' && req.failureReason && (
                              <span className="text-red-600">{req.failureReason}</span>
                            )}
                            {req.status === 'AWAITING_PARTNER' && req.partnerName && (
                              <span>Coordinating with {req.partnerName}</span>
                            )}
                            {req.status === 'COMPLETED' && req.processedAt && (
                              <span className="text-green-600">
                                Refunded on {formatDate(req.processedAt)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Back Link */}
          <div className="mt-8 text-center">
            <Link href="/account" className="text-primary-600 hover:underline">
              &larr; Back to My Account
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
