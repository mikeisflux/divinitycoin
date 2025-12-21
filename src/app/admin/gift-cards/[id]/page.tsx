// app/admin/gift-cards/[id]/page.tsx
// Gift card detail page with full CRUD functionality

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  createdAt: string;
}

interface GiftCard {
  id: string;
  codeLast4: string;
  amount: string;
  status: string;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  purchaser: { email: string } | null;
  purchasedByEmail: string | null;
  redeemedBy: { email: string } | null;
  redeemedByEmail: string | null;
  redeemedAt: string | null;
  redeemedOnPlatform: string | null;
  redeemedByPlatformUserId: string | null;
  stripeCheckoutSessionId: string | null;
  transactions: Transaction[];
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

export default function GiftCardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params.id as string;

  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');

  useEffect(() => {
    fetchGiftCard();
  }, [cardId]);

  async function fetchGiftCard() {
    try {
      const response = await fetch(`/api/admin/gift-cards/${cardId}`);
      if (response.ok) {
        const data = await response.json();
        setGiftCard(data.giftCard);
        // Initialize edit values
        setEditAmount(data.giftCard.amount);
        setEditStatus(data.giftCard.status);
        setEditExpiresAt(data.giftCard.expiresAt ? new Date(data.giftCard.expiresAt).toISOString().split('T')[0] : '');
      } else if (response.status === 404) {
        router.push('/admin/gift-cards');
      }
    } catch (err) {
      console.error('Failed to fetch gift card:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'revoke' | 'reactivate') {
    if (action === 'revoke' && !confirm('Are you sure you want to revoke this gift card?')) {
      return;
    }

    setActionLoading(action);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/gift-cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || `Failed to ${action} gift card` });
        return;
      }

      setMessage({ type: 'success', text: `Gift card ${action === 'revoke' ? 'revoked' : 'reactivated'} successfully!` });
      fetchGiftCard();
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to ${action} gift card` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendEmail() {
    setActionLoading('resend');
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/gift-cards/${cardId}/resend`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to resend email' });
        return;
      }

      setMessage({ type: 'success', text: 'Email sent successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to resend email' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveEdit() {
    setActionLoading('save');
    setMessage(null);

    try {
      const updates: Record<string, unknown> = {};

      if (editAmount !== giftCard?.amount) {
        updates.amount = editAmount;
      }
      if (editStatus !== giftCard?.status) {
        updates.status = editStatus;
      }
      if (editExpiresAt !== (giftCard?.expiresAt ? new Date(giftCard.expiresAt).toISOString().split('T')[0] : '')) {
        updates.expiresAt = editExpiresAt || null;
      }

      if (Object.keys(updates).length === 0) {
        setMessage({ type: 'error', text: 'No changes to save' });
        setActionLoading(null);
        return;
      }

      const response = await fetch(`/api/admin/gift-cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update gift card' });
        return;
      }

      setMessage({ type: 'success', text: 'Gift card updated successfully!' });
      setIsEditing(false);
      fetchGiftCard();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update gift card' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this gift card? This cannot be undone.')) {
      return;
    }

    setActionLoading('delete');
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/gift-cards/${cardId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete gift card' });
        return;
      }

      router.push('/admin/gift-cards');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete gift card' });
      setActionLoading(null);
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    if (giftCard) {
      setEditAmount(giftCard.amount);
      setEditStatus(giftCard.status);
      setEditExpiresAt(giftCard.expiresAt ? new Date(giftCard.expiresAt).toISOString().split('T')[0] : '');
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

  if (!giftCard) {
    return (
      <AdminLayout title="Gift Card Not Found" description="">
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">This gift card does not exist.</p>
          <Button onClick={() => router.push('/admin/gift-cards')}>Back to Gift Cards</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Gift Card ****${giftCard.codeLast4}`}
      description={`${formatCurrency(Number(giftCard.amount))} - ${giftCard.status}`}
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Card Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Gift Card Details</h2>
              {!isEditing && giftCard.status !== 'REDEEMED' && (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Expires At</label>
                  <input
                    type="date"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Leave empty for no expiration</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={actionLoading === 'save'}
                  >
                    {actionLoading === 'save' ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={actionLoading === 'save'}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
            )}
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
                  <button
                    onClick={handleResendEmail}
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
                        Resend Code Email
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleAction('revoke')}
                    disabled={actionLoading === 'revoke'}
                    className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionLoading === 'revoke' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        Revoking...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Revoke Card
                      </>
                    )}
                  </button>
                </>
              )}
              {giftCard.status === 'REVOKED' && (
                <button
                  onClick={() => handleAction('reactivate')}
                  disabled={actionLoading === 'reactivate'}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'reactivate' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      Reactivating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Reactivate Card
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          {giftCard.status !== 'REDEEMED' && (
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <h3 className="font-semibold text-red-800 mb-2">Danger Zone</h3>
              <p className="text-sm text-neutral-600 mb-4">
                Once you delete a gift card, there is no going back. Please be certain.
              </p>
              <button
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'delete' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Gift Card
                  </>
                )}
              </button>
            </div>
          )}

          {/* Back Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/admin/gift-cards')}
          >
            Back to Gift Cards
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
