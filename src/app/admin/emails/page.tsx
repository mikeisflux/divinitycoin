// app/admin/emails/page.tsx
// Email management dashboard

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getEmailStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    sent24h,
    sent7d,
    delivered,
    opened,
    bounced,
    failed,
    recentEmails,
  ] = await Promise.all([
    prisma.emailLog.count(),
    prisma.emailLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.emailLog.count({ where: { createdAt: { gte: last7d } } }),
    prisma.emailLog.count({ where: { status: 'DELIVERED' } }),
    prisma.emailLog.count({ where: { status: 'OPENED' } }),
    prisma.emailLog.count({ where: { status: 'BOUNCED' } }),
    prisma.emailLog.count({ where: { status: 'FAILED' } }),
    prisma.emailLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const deliveryRate = total > 0 ? ((delivered + opened) / total) * 100 : 0;
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;

  return {
    total,
    sent24h,
    sent7d,
    delivered,
    opened,
    bounced,
    failed,
    deliveryRate,
    openRate,
    recentEmails,
  };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SENT: 'bg-blue-100 text-blue-800',
    DELIVERED: 'bg-green-100 text-green-800',
    OPENED: 'bg-emerald-100 text-emerald-800',
    CLICKED: 'bg-teal-100 text-teal-800',
    BOUNCED: 'bg-orange-100 text-orange-800',
    FAILED: 'bg-red-100 text-red-800',
    SPAM: 'bg-red-100 text-red-800',
    QUEUED: 'bg-yellow-100 text-yellow-800',
    SENDING: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

export default async function EmailsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const stats = await getEmailStats();

  return (
    <AdminLayout
      title="Email Dashboard"
      description="Monitor email delivery and performance"
      actions={
        <div className="flex gap-3">
          <Link
            href="/admin/emails/templates"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
          >
            Templates
          </Link>
          <Link
            href="/admin/emails/logs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
          >
            View All Logs
          </Link>
        </div>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Emails</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Last 24 Hours</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">{stats.sent24h}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Delivery Rate</h3>
          <p className="text-2xl font-semibold text-green-600 mt-2">{stats.deliveryRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Open Rate</h3>
          <p className="text-2xl font-semibold text-primary-600 mt-2">{stats.openRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Delivered</span>
            <span className="text-lg font-semibold text-green-600">{stats.delivered}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Opened</span>
            <span className="text-lg font-semibold text-emerald-600">{stats.opened}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Bounced</span>
            <span className="text-lg font-semibold text-orange-600">{stats.bounced}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Failed</span>
            <span className="text-lg font-semibold text-red-600">{stats.failed}</span>
          </div>
        </div>
      </div>

      {/* Recent Emails */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Recent Emails</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {stats.recentEmails.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                  No emails sent yet
                </td>
              </tr>
            ) : (
              stats.recentEmails.map((email) => (
                <tr key={email.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {email.toEmail}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">
                    {email.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={email.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(email.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
