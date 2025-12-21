// app/admin/emails/logs/page.tsx
// Email logs page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { EmailStatus } from '@prisma/client';

async function getEmailLogs(page: number = 1, status?: string) {
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const where = status ? { status: status as EmailStatus } : {};

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.emailLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: 'bg-yellow-100 text-yellow-800',
    SENDING: 'bg-blue-100 text-blue-800',
    SENT: 'bg-blue-100 text-blue-800',
    DELIVERED: 'bg-green-100 text-green-800',
    OPENED: 'bg-emerald-100 text-emerald-800',
    CLICKED: 'bg-teal-100 text-teal-800',
    BOUNCED: 'bg-orange-100 text-orange-800',
    FAILED: 'bg-red-100 text-red-800',
    SPAM: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const status = searchParams.status;
  const data = await getEmailLogs(page, status);

  const statuses = ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED', 'SPAM'];

  return (
    <AdminLayout
      title="Email Logs"
      description={`Viewing ${data.total} emails`}
    >
      <div className="mb-6">
        <Link href="/admin/emails" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Email Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/emails/logs"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !status ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            All
          </Link>
          {statuses.map((s) => (
            <Link
              key={s}
              href={`/admin/emails/logs?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                status === s ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Recipient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Template</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Sent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Event</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                  No emails found
                </td>
              </tr>
            ) : (
              data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-neutral-900">{log.toEmail}</div>
                    {log.toName && <div className="text-xs text-neutral-500">{log.toName}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">
                    {log.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {log.templateName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {log.events[0]
                      ? new Date(log.events[0].createdAt).toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Link
                href={`/admin/emails/logs?page=${data.page - 1}${status ? `&status=${status}` : ''}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={`/admin/emails/logs?page=${data.page + 1}${status ? `&status=${status}` : ''}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
