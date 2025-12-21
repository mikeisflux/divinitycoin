// app/admin/gift-cards/[id]/page.tsx
// Gift card detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

async function getGiftCard(id: string) {
  return prisma.giftCard.findUnique({
    where: { id },
    include: {
      purchaser: true,
      redeemedBy: true,
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    REDEEMED: 'bg-blue-100 text-blue-800',
    EXPIRED: 'bg-neutral-100 text-neutral-800',
    REVOKED: 'bg-red-100 text-red-800',
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

export default async function GiftCardDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const giftCard = await getGiftCard(params.id);

  if (!giftCard) {
    notFound();
  }

  return (
    <AdminLayout
      title={`Gift Card ****${giftCard.codeLast4}`}
      description={`${formatCurrency(Number(giftCard.amount))} - ${giftCard.status}`}
    >
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Card Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Gift Card Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Card ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">{giftCard.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Code (Last 4)</dt>
                <dd className="text-neutral-900 font-mono">****{giftCard.codeLast4}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Amount</dt>
                <dd className="text-2xl font-semibold text-neutral-900">
                  {formatCurrency(Number(giftCard.amount))}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Status</dt>
                <dd><StatusBadge status={giftCard.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Created</dt>
                <dd className="text-neutral-900">{new Date(giftCard.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Activated</dt>
                <dd className="text-neutral-900">
                  {giftCard.activatedAt ? new Date(giftCard.activatedAt).toLocaleString() : '-'}
                </dd>
              </div>
              {giftCard.expiresAt && (
                <div>
                  <dt className="text-sm text-neutral-500">Expires</dt>
                  <dd className="text-neutral-900">{new Date(giftCard.expiresAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Purchase Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Purchase Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Purchased By</dt>
                <dd className="text-neutral-900">
                  {giftCard.purchaser?.email || giftCard.purchasedByEmail || 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Stripe Session</dt>
                <dd className="text-neutral-900 font-mono text-sm">
                  {giftCard.stripeCheckoutSessionId?.slice(0, 20) || '-'}...
                </dd>
              </div>
            </dl>
          </div>

          {/* Redemption Info */}
          {giftCard.status === 'REDEEMED' && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Redemption Information</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-neutral-500">Redeemed By</dt>
                  <dd className="text-neutral-900">
                    {giftCard.redeemedBy?.email || giftCard.redeemedByEmail || 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Redeemed At</dt>
                  <dd className="text-neutral-900">
                    {giftCard.redeemedAt ? new Date(giftCard.redeemedAt).toLocaleString() : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Platform</dt>
                  <dd className="text-neutral-900">{giftCard.redeemedOnPlatform || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Platform User ID</dt>
                  <dd className="text-neutral-900 font-mono text-sm">
                    {giftCard.redeemedByPlatformUserId || '-'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Transaction History</h2>
            {giftCard.transactions.length === 0 ? (
              <p className="text-neutral-500 text-sm">No transactions for this gift card.</p>
            ) : (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Type</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Amount</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {giftCard.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 text-sm text-neutral-900">{tx.type}</td>
                      <td className="py-3 text-sm font-medium">{formatCurrency(Number(tx.amount))}</td>
                      <td className="py-3"><StatusBadge status={tx.status} /></td>
                      <td className="py-3 text-sm text-neutral-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Actions</h3>
            <div className="space-y-2">
              {giftCard.status === 'ACTIVE' && (
                <>
                  <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                    Resend Code Email
                  </button>
                  <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                    Revoke Card
                  </button>
                </>
              )}
              {giftCard.status === 'REVOKED' && (
                <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition">
                  Reactivate Card
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
