// app/admin/users/[id]/page.tsx
// User detail page with edit functionality

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  stripeCustomerId: string | null;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  creditBalances: Array<{
    availableBalance: string;
    heldBalance: string;
    holds: Array<{ id: string; amount: string; status: string }>;
  }>;
  purchasedCards: Array<{
    id: string;
    codeLast4: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: string;
    status: string;
    stripePaymentIntentId: string | null;
    createdAt: string;
  }>;
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
    REFUNDED: 'bg-purple-100 text-purple-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [banning, setBanning] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    emailVerified: false,
  });

  useEffect(() => {
    fetchUser();
  }, [userId]);

  async function fetchUser() {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setEditForm({
          name: data.user.name || '',
          email: data.user.email,
          password: '',
          emailVerified: !!data.user.emailVerified,
        });
      } else if (response.status === 404) {
        router.push('/admin/users');
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update user');
        return;
      }

      setShowEditModal(false);
      setMessage('User updated successfully');
      fetchUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete user');
        setDeleting(false);
        return;
      }

      router.push('/admin/users');
    } catch (err) {
      setError('Failed to delete user');
      setDeleting(false);
    }
  }

  async function handleBan() {
    setBanning(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to ban user');
        setBanning(false);
        return;
      }

      setShowBanModal(false);
      setBanReason('');
      setMessage('User has been banned');
      fetchUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to ban user');
    } finally {
      setBanning(false);
    }
  }

  async function handleUnban() {
    setBanning(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to unban user');
        setBanning(false);
        return;
      }

      setMessage('User has been unbanned');
      fetchUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to unban user');
    } finally {
      setBanning(false);
    }
  }

  async function handleRefund() {
    if (!selectedTransaction) return;

    setRefunding(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/transactions/${selectedTransaction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to refund transaction');
        setRefunding(false);
        return;
      }

      setShowRefundModal(false);
      setSelectedTransaction(null);
      setMessage('Transaction has been refunded');
      fetchUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to refund transaction');
    } finally {
      setRefunding(false);
    }
  }

  function openRefundModal(transactionId: string) {
    setSelectedTransaction(transactionId);
    setShowRefundModal(true);
    setError('');
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

  if (!user) {
    return (
      <AdminLayout title="User Not Found" description="The user could not be found">
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">This user does not exist or has been deleted.</p>
          <Button onClick={() => router.push('/admin/users')}>Back to Users</Button>
        </div>
      </AdminLayout>
    );
  }

  const totalBalance = user.creditBalances.reduce((sum, b) => sum + Number(b.availableBalance), 0);
  const totalHeld = user.creditBalances.reduce((sum, b) => sum + Number(b.heldBalance), 0);

  return (
    <AdminLayout
      title={user.name || user.email}
      description="User profile and activity"
      actions={
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            Edit User
          </Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      }
    >
      {message && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          {message}
        </div>
      )}

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
                  {user.emailVerified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {new Date(user.emailVerified).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                      No
                    </span>
                  )}
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
              <div>
                <dt className="text-sm text-neutral-500">Account Status</dt>
                <dd className="text-neutral-900">
                  {user.bannedAt ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Banned on {new Date(user.bannedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </dd>
              </div>
              {user.bannedAt && user.banReason && (
                <div className="col-span-2">
                  <dt className="text-sm text-neutral-500">Ban Reason</dt>
                  <dd className="text-red-700">{user.banReason}</dd>
                </div>
              )}
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
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Actions</th>
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
                      <td className="py-3">
                        {tx.type === 'PURCHASE' && tx.status === 'COMPLETED' && tx.stripePaymentIntentId && (
                          <button
                            onClick={() => openRefundModal(tx.id)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Refund
                          </button>
                        )}
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

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
              {user.stripeCustomerId && (
                <a
                  href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
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
              {user.bannedAt ? (
                <button
                  onClick={handleUnban}
                  disabled={banning}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {banning ? 'Unbanning...' : 'Unban User'}
                </button>
              ) : (
                <button
                  onClick={() => setShowBanModal(true)}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-orange-600 hover:bg-orange-50 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Ban User
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Edit User</h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="User's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Leave empty to keep current"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Leave empty to keep current password
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emailVerified"
                    checked={editForm.emailVerified}
                    onChange={(e) => setEditForm({ ...editForm, emailVerified: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="emailVerified" className="text-sm text-neutral-700">
                    Email verified
                  </label>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowEditModal(false);
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Delete User</h2>
              <p className="text-neutral-600 mb-4">
                Are you sure you want to delete <strong>{user.email}</strong>? This action cannot be undone.
              </p>

              {(totalBalance > 0 || totalHeld > 0) && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4">
                  This user has a balance of {formatCurrency(totalBalance + totalHeld)}. The balance must be cleared before deletion.
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete User'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowBanModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Ban User</h2>
              <p className="text-neutral-600 mb-4">
                Are you sure you want to ban <strong>{user.email}</strong>? They will be logged out and unable to access their account.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="Enter reason for ban..."
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowBanModal(false);
                    setBanReason('');
                    setError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50"
                  onClick={handleBan}
                  disabled={banning}
                >
                  {banning ? 'Banning...' : 'Ban User'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Transaction Modal */}
      {showRefundModal && selectedTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowRefundModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Refund Transaction</h2>
              <p className="text-neutral-600 mb-4">
                Are you sure you want to refund this transaction? The payment will be returned to the customer&apos;s original payment method.
              </p>

              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4">
                This action cannot be undone. The associated gift card will be invalidated.
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowRefundModal(false);
                    setSelectedTransaction(null);
                    setError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                  onClick={handleRefund}
                  disabled={refunding}
                >
                  {refunding ? 'Processing...' : 'Refund Transaction'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
