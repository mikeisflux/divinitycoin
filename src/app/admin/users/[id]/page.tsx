// app/admin/users/[id]/page.tsx
// User detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      creditBalances: {
        include: {
          holds: {
            where: { status: 'ACTIVE' },
          },
        },
      },
      purchasedCards: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACTIVE: 'bg-green-100 text-green-800',
    REDEEMED: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const user = await getUser(params.id);

  if (!user) {
    notFound();
  }

  const totalBalance = user.creditBalances.reduce((sum: number, b: { availableBalance: unknown }) => sum + Number(b.availableBalance), 0);
  const totalHeld = user.creditBalances.reduce((sum: number, b: { heldBalance: unknown }) => sum + Number(b.heldBalance), 0);

  return (
    <AdminLayout
      title={user.name || user.email}
      description={`User profile and activity`}
    >
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">User Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">User ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">{user.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Name</dt>
                <dd className="text-neutral-900">{user.name || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Email Verified</dt>
                <dd className="text-neutral-900">
                  {user.emailVerified ? new Date(user.emailVerified).toLocaleDateString() : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Stripe Customer ID</dt>
                <dd className="text-neutral-900 font-mono text-sm">{user.stripeCustomerId || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Member Since</dt>
                <dd className="text-neutral-900">{new Date(user.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Recent Transactions</h2>
            {user.transactions.length === 0 ? (
              <p className="text-neutral-500 text-sm">No transactions yet.</p>
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
                  {user.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 text-sm text-neutral-900">{tx.type}</td>
                      <td className="py-3 text-sm font-medium">{formatCurrency(Number(tx.amount))}</td>
                      <td className="py-3"><StatusBadge status={tx.status} /></td>
                      <td className="py-3 text-sm text-neutral-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Purchased Gift Cards */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Purchased Gift Cards</h2>
            {user.purchasedCards.length === 0 ? (
              <p className="text-neutral-500 text-sm">No gift cards purchased.</p>
            ) : (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Code</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Amount</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {user.purchasedCards.map((card) => (
                    <tr key={card.id}>
                      <td className="py-3 text-sm font-mono text-neutral-900">****{card.codeLast4}</td>
                      <td className="py-3 text-sm font-medium">{formatCurrency(Number(card.amount))}</td>
                      <td className="py-3"><StatusBadge status={card.status} /></td>
                      <td className="py-3 text-sm text-neutral-500">
                        {new Date(card.createdAt).toLocaleDateString()}
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
          {/* Balance Summary */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Credit Balance</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-500">Available</p>
                <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalBalance)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Held</p>
                <p className="text-lg font-medium text-neutral-600">{formatCurrency(totalHeld)}</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-neutral-500">Total</p>
                <p className="text-xl font-semibold text-neutral-900">{formatCurrency(totalBalance + totalHeld)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                Adjust Balance
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                View in Stripe
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                Suspend User
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
