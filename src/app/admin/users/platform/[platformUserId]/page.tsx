// app/admin/users/platform/[platformUserId]/page.tsx
// Platform user detail page

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface CreditBalance {
  id: string;
  platformUserId: string;
  email: string | null;
  userId: string | null;
  availableBalance: string;
  heldBalance: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null } | null;
  holds: Array<{
    id: string;
    amount: string;
    pledgeId: string;
    projectId: string;
    status: string;
    createdAt: string;
    capturedAt: string | null;
    releasedAt: string | null;
  }>;
  ledgerEntries: Array<{
    id: string;
    type: string;
    amount: string;
    balanceAfter: string;
    description: string;
    createdAt: string;
  }>;
}

interface PlatformUserRecord {
  id: string;
  partnerId: string;
  platformUserId: string;
  email: string;
  stripeCustomerId: string | null;
  createdAt: string;
}

interface PartnerPayment {
  id: string;
  paymentIntentId: string;
  partnerId: string;
  platformUserId: string;
  pledgeId: string;
  projectId: string;
  amount: number;
  currency: string;
  email: string;
  status: string;
  giftCardId: string | null;
  holdId: string | null;
  refundId: string | null;
  refundedAt: string | null;
  createdAt: string;
  completedAt: string | null;
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
    CAPTURED: 'bg-blue-100 text-blue-800',
    RELEASED: 'bg-neutral-100 text-neutral-800',
    EXPIRED: 'bg-neutral-100 text-neutral-600',
    REFUNDED: 'bg-purple-100 text-purple-800',
    FAILED: 'bg-red-100 text-red-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

function LedgerTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    REDEMPTION: 'bg-green-100 text-green-800',
    HOLD_PLACED: 'bg-yellow-100 text-yellow-800',
    HOLD_RELEASED: 'bg-blue-100 text-blue-800',
    HOLD_CAPTURED: 'bg-purple-100 text-purple-800',
    ADJUSTMENT: 'bg-neutral-100 text-neutral-800',
    REFUND: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-neutral-100 text-neutral-800'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

export default function PlatformUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const platformUserId = params.platformUserId as string;

  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [platformUser, setPlatformUser] = useState<PlatformUserRecord | null>(null);
  const [partnerPayments, setPartnerPayments] = useState<PartnerPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformUser();
  }, [platformUserId]);

  async function fetchPlatformUser() {
    try {
      const response = await fetch(`/api/admin/users/platform/${platformUserId}`);
      if (response.ok) {
        const data = await response.json();
        setCreditBalance(data.creditBalance);
        setPlatformUser(data.platformUser);
        setPartnerPayments(data.partnerPayments || []);
      } else if (response.status === 404) {
        router.push('/admin/users');
      }
    } catch (err) {
      console.error('Failed to fetch platform user:', err);
    } finally {
      setLoading(false);
    }
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

  if (!creditBalance) {
    return (
      <AdminLayout title="Platform User Not Found" description="The platform user could not be found">
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">This platform user does not exist.</p>
          <Button onClick={() => router.push('/admin/users')}>Back to Users</Button>
        </div>
      </AdminLayout>
    );
  }

  const availableBalance = Number(creditBalance.availableBalance);
  const heldBalance = Number(creditBalance.heldBalance);
  const completedPayments = partnerPayments.filter(pp => pp.status === 'COMPLETED');
  const totalPurchased = completedPayments.reduce((sum, pp) => sum + pp.amount / 100, 0);

  return (
    <AdminLayout
      title={creditBalance.email || platformUserId}
      description="Platform user profile and activity"
      actions={
        <Button variant="outline" onClick={() => router.push('/admin/users')}>
          Back to Users
        </Button>
      }
    >
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Platform User Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Platform User ID</dt>
                <dd className="text-neutral-900 font-mono text-sm break-all">{platformUserId}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{creditBalance.email || 'Unknown'}</dd>
              </div>
              {platformUser && (
                <>
                  <div>
                    <dt className="text-sm text-neutral-500">Partner ID</dt>
                    <dd className="text-neutral-900 font-mono text-sm">{platformUser.partnerId}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-neutral-500">Stripe Customer ID</dt>
                    <dd className="text-neutral-900 font-mono text-sm">{platformUser.stripeCustomerId || '-'}</dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm text-neutral-500">Linked DC Account</dt>
                <dd className="text-neutral-900">
                  {creditBalance.user ? (
                    <button
                      onClick={() => router.push(`/admin/users/${creditBalance.user!.id}`)}
                      className="text-primary-600 hover:text-primary-900 text-sm"
                    >
                      {creditBalance.user.email}
                    </button>
                  ) : (
                    <span className="text-neutral-500">Not linked</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">First Seen</dt>
                <dd className="text-neutral-900">{new Date(creditBalance.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Partner Payments */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Partner Payments ({partnerPayments.length})
            </h2>
            {partnerPayments.length === 0 ? (
              <p className="text-neutral-500 text-sm">No partner payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Payment</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Pledge</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Amount</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Hold</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {partnerPayments.map((pp) => (
                      <tr key={pp.id}>
                        <td className="py-3">
                          <div className="text-sm text-neutral-900 font-mono">{pp.paymentIntentId.slice(0, 15)}...</div>
                        </td>
                        <td className="py-3">
                          <div className="text-sm text-neutral-900 font-mono">{pp.pledgeId.slice(0, 12)}...</div>
                          <div className="text-xs text-neutral-500">Project: {pp.projectId.slice(0, 12)}...</div>
                        </td>
                        <td className="py-3 text-sm font-medium text-green-600">
                          {formatCurrency(pp.amount / 100)}
                        </td>
                        <td className="py-3"><StatusBadge status={pp.status} /></td>
                        <td className="py-3 text-sm text-neutral-500">
                          {pp.holdId ? (
                            <span className="text-green-600 font-mono text-xs">{pp.holdId.slice(0, 8)}...</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 text-sm text-neutral-500">
                          {new Date(pp.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credit Holds */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Credit Holds ({creditBalance.holds.length})
            </h2>
            {creditBalance.holds.length === 0 ? (
              <p className="text-neutral-500 text-sm">No credit holds.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Hold ID</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Pledge</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Amount</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {creditBalance.holds.map((hold) => (
                      <tr key={hold.id}>
                        <td className="py-3 text-sm font-mono text-neutral-900">{hold.id.slice(0, 12)}...</td>
                        <td className="py-3">
                          <div className="text-sm font-mono text-neutral-900">{hold.pledgeId.slice(0, 12)}...</div>
                          <div className="text-xs text-neutral-500">Project: {hold.projectId.slice(0, 12)}...</div>
                        </td>
                        <td className="py-3 text-sm font-medium">{formatCurrency(Number(hold.amount))}</td>
                        <td className="py-3"><StatusBadge status={hold.status} /></td>
                        <td className="py-3 text-sm text-neutral-500">
                          {new Date(hold.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ledger History */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Credit Ledger ({creditBalance.ledgerEntries.length})
            </h2>
            {creditBalance.ledgerEntries.length === 0 ? (
              <p className="text-neutral-500 text-sm">No ledger entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Type</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Amount</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Balance After</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Description</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {creditBalance.ledgerEntries.map((entry) => {
                      const amount = Number(entry.amount);
                      return (
                        <tr key={entry.id}>
                          <td className="py-3"><LedgerTypeBadge type={entry.type} /></td>
                          <td className={`py-3 text-sm font-medium ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {amount >= 0 ? '+' : ''}{formatCurrency(amount)}
                          </td>
                          <td className="py-3 text-sm text-neutral-900">{formatCurrency(Number(entry.balanceAfter))}</td>
                          <td className="py-3 text-sm text-neutral-500 max-w-xs truncate">{entry.description}</td>
                          <td className="py-3 text-sm text-neutral-500">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                <p className="text-2xl font-semibold text-green-600">{formatCurrency(availableBalance)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Held</p>
                <p className="text-lg font-medium text-neutral-600">{formatCurrency(heldBalance)}</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-neutral-500">Total</p>
                <p className="text-xl font-semibold text-neutral-900">{formatCurrency(availableBalance + heldBalance)}</p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Total Purchased</span>
                <span className="text-sm font-medium text-neutral-900">{formatCurrency(totalPurchased)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Completed Payments</span>
                <span className="text-sm font-medium text-neutral-900">{completedPayments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Total Payments</span>
                <span className="text-sm font-medium text-neutral-900">{partnerPayments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Active Holds</span>
                <span className="text-sm font-medium text-neutral-900">
                  {creditBalance.holds.filter(h => h.status === 'ACTIVE').length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {platformUser?.stripeCustomerId && (
                <a
                  href={`https://dashboard.stripe.com/customers/${platformUser.stripeCustomerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in Stripe
                </a>
              )}
              <button
                onClick={() => router.push('/admin/users')}
                className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Users
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
