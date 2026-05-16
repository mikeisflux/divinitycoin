// app/admin/checkout/page.tsx
// Admin list of hosted checkout sessions.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface CheckoutSession {
  id: string;
  sessionToken: string;
  mode: 'PAYMENT' | 'SETUP';
  status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'EXPIRED' | 'CANCELED';
  amount: number | null;
  currency: string;
  email: string;
  platformUserId: string;
  partnerId: string;
  partnerName: string | null;
  partnerSlug: string | null;
  pledgeId: string | null;
  paymentIntentId: string | null;
  setupIntentId: string | null;
  paymentMethodId: string | null;
  expiresAt: string;
  completedAt: string | null;
  webhookFiredAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  COMPLETE: 'bg-green-100 text-green-800',
  FAILED:   'bg-red-100 text-red-800',
  EXPIRED:  'bg-neutral-100 text-neutral-700',
  CANCELED: 'bg-neutral-100 text-neutral-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {status}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const styles = mode === 'SETUP' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${styles}`}>
      {mode.toLowerCase()}
    </span>
  );
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CheckoutSessionsPage() {
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');

  const fetchSessions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (modeFilter) params.set('mode', modeFilter);

      const res = await fetch(`/api/admin/checkout?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch checkout sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, modeFilter]);

  useEffect(() => {
    fetchSessions(1);
  }, [fetchSessions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSessions(1);
  };

  return (
    <AdminLayout
      title="Checkout Sessions"
      description={`${pagination.total} total hosted checkout sessions`}
    >
      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by session id, email, platform user id, intent id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-sm"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-sm bg-white"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETE">Complete</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
          <div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-sm bg-white"
            >
              <option value="">All modes</option>
              <option value="PAYMENT">Payment</option>
              <option value="SETUP">Setup</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Session</th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Partner</th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Mode</th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No checkout sessions match those filters.</td></tr>
              ) : sessions.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/checkout/${s.id}`}
                      className="font-mono text-xs text-primary-600 hover:underline"
                      title={s.sessionToken}
                    >
                      {s.sessionToken.slice(0, 12)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-900">{s.partnerName ?? s.partnerId}</td>
                  <td className="px-4 py-3"><ModeBadge mode={s.mode} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-sm text-neutral-900 text-right font-mono">{formatCurrency(s.amount, s.currency)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{s.email}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
            <span className="text-neutral-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} sessions
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchSessions(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 border border-neutral-200 rounded text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchSessions(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 border border-neutral-200 rounded text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
