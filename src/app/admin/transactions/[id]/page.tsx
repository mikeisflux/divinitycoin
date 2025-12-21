// app/admin/transactions/[id]/page.tsx
// Transaction detail page with working actions

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface GiftCard {
  id: string;
  codeLast4: string;
  amount: string;
  status: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeRefundId: string | null;
  userId: string | null;
  guestEmail: string | null;
  giftCardId: string | null;
  user: { email: string } | null;
  giftCard: GiftCard | null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTransaction();
  }, [transactionId]);

  async function fetchTransaction() {
    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}`);
      if (response.ok) {
        const data = await response.json();
        setTransaction(data.transaction);
      } else if (response.status === 404) {
        router.push('/admin/transactions');
      }
    } catch (err) {
      console.error('Failed to fetch transaction:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefund() {
    if (!confirm('Are you sure you want to refund this transaction? This action cannot be undone.')) {
      return;
    }

    setActionLoading('refund');
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to process refund' });
        return;
      }

      setMessage({ type: 'success', text: 'Refund processed successfully!' });
      fetchTransaction();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to process refund' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendReceipt() {
    setActionLoading('resend');
    setMessage(null);

    // For now, just show a message - receipt email would require additional implementation
    setMessage({ type: 'error', text: 'Receipt email functionality not yet implemented' });
    setActionLoading(null);
  }

  if (loading) {
    return (
      <AdminLayout title="Loading..." description="Please wait">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!transaction) {
    return (
      <AdminLayout title="Transaction Not Found" description="">
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">This transaction does not exist.</p>
          <Button onClick={() => router.push('/admin/transactions')}>Back to Transactions</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Transaction ${transaction.id.slice(0, 8)}...`}
      description={`${transaction.type} - ${formatCurrency(Number(transaction.amount))}`}
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Transaction Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Transaction ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">{transaction.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Type</dt>
                <dd className="text-neutral-900">{transaction.type}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Amount</dt>
                <dd className={`text-lg font-semibold ${transaction.type === 'REFUND' ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.type === 'REFUND' ? '-' : ''}{formatCurrency(Number(transaction.amount))}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Status</dt>
                <dd><StatusBadge status={transaction.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Created</dt>
                <dd className="text-neutral-900">{new Date(transaction.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Completed</dt>
                <dd className="text-neutral-900">
                  {transaction.completedAt ? new Date(transaction.completedAt).toLocaleString() : '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Stripe Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Stripe Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-neutral-500">Payment Intent ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">
                  {transaction.stripePaymentIntentId || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Checkout Session ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">
                  {transaction.stripeCheckoutSessionId || '-'}
                </dd>
              </div>
              {transaction.stripeRefundId && (
                <div>
                  <dt className="text-sm text-neutral-500">Refund ID</dt>
                  <dd className="text-neutral-900 font-mono text-sm">{transaction.stripeRefundId}</dd>
                </div>
              )}
            </dl>
            {transaction.stripePaymentIntentId && (
              <a
                href={`https://dashboard.stripe.com/payments/${transaction.stripePaymentIntentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-sm text-primary-600 hover:underline"
              >
                View in Stripe Dashboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Customer</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{transaction.user?.email || transaction.guestEmail || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">User ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">{transaction.userId || 'Guest'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Related Gift Card */}
          {transaction.giftCard && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Related Gift Card</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Code</dt>
                  <dd className="text-neutral-900 font-mono">****{transaction.giftCard.codeLast4}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Amount</dt>
                  <dd className="text-neutral-900">{formatCurrency(Number(transaction.giftCard.amount))}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Status</dt>
                  <dd><StatusBadge status={transaction.giftCard.status} /></dd>
                </div>
              </dl>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Actions</h3>
            <div className="space-y-2">
              {transaction.status === 'COMPLETED' && transaction.type === 'PURCHASE' && (
                <button
                  onClick={handleRefund}
                  disabled={actionLoading === 'refund'}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'refund' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Issue Refund
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleResendReceipt}
                disabled={actionLoading === 'resend'}
                className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === 'resend' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-600"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Resend Receipt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
