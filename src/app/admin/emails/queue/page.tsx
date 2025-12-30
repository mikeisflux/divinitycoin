// app/admin/emails/queue/page.tsx
// Email queue management page

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
  estimatedMinutesRemaining: number;
  recentBulkSends: number;
}

interface QueueItem {
  id: string;
  toEmail: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  bulkSendId: string | null;
  createdAt: string;
  sentAt: string | null;
}

export default function EmailQueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchQueue() {
    try {
      const res = await fetch('/api/admin/email-queue');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setItems(data.recentItems || []);
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string, emailId?: string) {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, emailId }),
      });
      if (res.ok) {
        fetchQueue();
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      SENT: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-neutral-100 text-neutral-600',
    };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-neutral-100'}`}>
        {status}
      </span>
    );
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  }

  return (
    <AdminLayout
      title="Email Queue"
      description="Monitor and manage the email sending queue"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
              <div className="text-sm text-neutral-500">Pending</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-2xl font-bold text-blue-600">{stats?.processing || 0}</div>
              <div className="text-sm text-neutral-500">Processing</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-2xl font-bold text-green-600">{stats?.sent || 0}</div>
              <div className="text-sm text-neutral-500">Sent</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
              <div className="text-sm text-neutral-500">Failed</div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-2xl font-bold text-neutral-900">
                {stats?.estimatedMinutesRemaining || 0}m
              </div>
              <div className="text-sm text-neutral-500">Est. Time Left</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <Button
              variant="outline"
              onClick={() => handleAction('retry-all-failed')}
              disabled={actionLoading !== null || (stats?.failed || 0) === 0}
            >
              {actionLoading === 'retry-all-failed' ? 'Retrying...' : 'Retry All Failed'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('cancel')}
              disabled={actionLoading !== null || (stats?.pending || 0) === 0}
            >
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel All Pending'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('cleanup')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'cleanup' ? 'Cleaning...' : 'Cleanup Old (30d)'}
            </Button>
          </div>

          {/* Progress Bar (if there are pending emails) */}
          {(stats?.pending || 0) > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-600">Queue Progress</span>
                <span className="text-neutral-900 font-medium">
                  {stats?.sent || 0} / {(stats?.sent || 0) + (stats?.pending || 0) + (stats?.processing || 0)}
                </span>
              </div>
              <div className="h-3 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300"
                  style={{
                    width: `${((stats?.sent || 0) / ((stats?.sent || 0) + (stats?.pending || 0) + (stats?.processing || 0) || 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="text-xs text-neutral-500 mt-2">
                Processing at 1 email per second. Estimated {stats?.estimatedMinutesRemaining || 0} minutes remaining.
              </div>
            </div>
          )}

          {/* Queue Items Table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="font-semibold text-neutral-900">Recent Queue Items</h2>
            </div>
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Sent</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                      No emails in queue
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="truncate max-w-[200px]">{item.toEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="truncate max-w-[200px]">{item.subject}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(item.status)}
                        {item.lastError && (
                          <div className="text-xs text-red-600 mt-1 truncate max-w-[150px]" title={item.lastError}>
                            {item.lastError}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{item.attempts}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(item.createdAt)}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(item.sentAt)}</td>
                      <td className="px-6 py-4 text-right">
                        {item.status === 'FAILED' && (
                          <button
                            onClick={() => handleAction('retry', item.id)}
                            className="text-primary-600 hover:text-primary-900 text-sm"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Cron Setup Info */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Queue Processing Setup</h3>
            <p className="text-sm text-blue-800 mb-2">
              The email queue requires a cron job to process pending emails. Set up a cron job to hit this endpoint every minute:
            </p>
            <code className="block bg-blue-100 text-blue-900 p-2 rounded text-sm overflow-x-auto">
              curl -X POST https://divinitycoin.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET
            </code>
            <p className="text-xs text-blue-700 mt-2">
              Add CRON_SECRET to your system config to secure the endpoint.
            </p>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
