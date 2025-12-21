// app/admin/transactions/[id]/page.tsx
// Transaction detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

async function getTransaction(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      user: true,
      giftCard: true,
    },
  });
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

export default async function TransactionDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const transaction = await getTransaction(params.id);

  if (!transaction) {
    notFound();
  }

  return (
    <AdminLayout
      title={`Transaction ${transaction.id.slice(0, 8)}...`}
      description={`${transaction.type} - ${formatCurrency(Number(transaction.amount))}`}
    >
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
                <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                  Issue Refund
                </button>
              )}
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                Resend Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
