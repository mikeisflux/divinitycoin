// app/admin/logs/api/page.tsx
// API request logs

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getApiLogs(page: number = 1) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Using admin audit log as a proxy for API logs
  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        admin: {
          select: { email: true, name: true },
        },
      },
    }),
    prisma.adminAuditLog.count(),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

function ActionBadge({ action }: { action: string }) {
  const getColor = (action: string) => {
    if (action.startsWith('CREATE')) return 'bg-green-100 text-green-800';
    if (action.startsWith('UPDATE')) return 'bg-blue-100 text-blue-800';
    if (action.startsWith('DELETE')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
    return 'bg-neutral-100 text-neutral-800';
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColor(action)}`}>
      {action}
    </span>
  );
}

export default async function ApiLogsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const data = await getApiLogs(page);

  return (
    <AdminLayout
      title="API Logs"
      description={`Viewing ${data.total} API requests`}
    >
      <div className="mb-6">
        <Link href="/admin/logs" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Logs
        </Link>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                  No API logs found
                </td>
              </tr>
            ) : (
              data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {log.resource}
                    {log.resourceId && (
                      <span className="text-neutral-500 ml-1">#{log.resourceId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {log.admin ? (
                      <div>
                        <div className="text-neutral-900">{log.admin.name || log.admin.email}</div>
                        {log.admin.name && (
                          <div className="text-neutral-500 text-xs">{log.admin.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-500">System</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-600">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 max-w-xs truncate">
                    {log.details ? JSON.stringify(JSON.parse(log.details)).slice(0, 50) : '-'}
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
                href={`/admin/logs/api?page=${data.page - 1}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={`/admin/logs/api?page=${data.page + 1}`}
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
