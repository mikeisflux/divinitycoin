// app/admin/logs/audit/page.tsx
// Admin audit log page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Prisma } from '@prisma/client';

type AuditLogWithAdmin = Prisma.AdminAuditLogGetPayload<{
  include: { admin: { select: { name: true; email: true } } };
}>;

async function getAuditLogs(page: number = 1, limit: number = 50) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.adminAuditLog.count(),
  ]);

  return { logs, total, pages: Math.ceil(total / limit) };
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    LOGIN_SUCCESS: 'bg-green-100 text-green-800',
    LOGIN_FAILED: 'bg-red-100 text-red-800',
    LOGOUT: 'bg-neutral-100 text-neutral-800',
    CONFIG_UPDATE: 'bg-blue-100 text-blue-800',
    CONFIG_DELETE: 'bg-orange-100 text-orange-800',
    PARTNER_CREATE: 'bg-purple-100 text-purple-800',
    PARTNER_UPDATE: 'bg-purple-100 text-purple-800',
    PARTNER_ACTIVATE: 'bg-green-100 text-green-800',
    PARTNER_DEACTIVATE: 'bg-red-100 text-red-800',
    GIFTCARD_GENERATE: 'bg-emerald-100 text-emerald-800',
    GIFTCARD_REVOKE: 'bg-red-100 text-red-800',
    GIFTCARD_RESEND_EMAIL: 'bg-blue-100 text-blue-800',
    TRANSACTION_REFUND: 'bg-orange-100 text-orange-800',
    USER_UPDATE: 'bg-blue-100 text-blue-800',
    USER_DELETE: 'bg-red-100 text-red-800',
    API_KEY_CREATE: 'bg-yellow-100 text-yellow-800',
    API_KEY_REVOKE: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[action] || 'bg-neutral-100 text-neutral-800'}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

interface Props {
  searchParams: { page?: string };
}

export default async function AuditLogsPage({ searchParams }: Props) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const { logs, total, pages } = await getAuditLogs(page);

  return (
    <AdminLayout
      title="Audit Logs"
      description="Track all admin actions and changes"
    >
      {/* Back Link */}
      <div className="mb-6">
        <Link href="/admin/logs" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Logs Overview
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500">Total Logs</p>
          <p className="text-2xl font-bold text-neutral-900">{total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500">Current Page</p>
          <p className="text-2xl font-bold text-neutral-900">{page} of {pages}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500">Showing</p>
          <p className="text-2xl font-bold text-neutral-900">{logs.length} entries</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log: AuditLogWithAdmin) => (
                  <tr key={log.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {log.admin?.name || log.admin?.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {log.resource}
                      {log.resourceId && (
                        <span className="text-neutral-400 font-mono text-xs ml-1">
                          ({log.resourceId.slice(0, 8)}...)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500 max-w-xs truncate">
                      {log.details ? (
                        <span className="font-mono text-xs">
                          {JSON.stringify(log.details).slice(0, 50)}...
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 font-mono">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
            <div className="text-sm text-neutral-500">
              Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} entries
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/logs/audit?page=${page - 1}`}
                  className="px-3 py-1 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/admin/logs/audit?page=${page + 1}`}
                  className="px-3 py-1 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
