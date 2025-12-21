// app/admin/logs/security/page.tsx
// Security audit logs

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getSecurityLogs(page: number = 1) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Security-related actions
  const securityActions = [
    'LOGIN',
    'LOGOUT',
    'LOGIN_FAILED',
    'PASSWORD_CHANGE',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'UNLOCK_ADMIN',
    'CREATE_ADMIN',
    'DELETE_ADMIN',
    'UPDATE_ADMIN',
    'API_KEY_CREATED',
    'API_KEY_REVOKED',
  ];

  const [logs, total, failedLogins, recentAdminChanges] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: {
        action: { in: securityActions },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        adminUser: {
          select: { email: true, name: true },
        },
      },
    }),
    prisma.adminAuditLog.count({
      where: { action: { in: securityActions } },
    }),
    prisma.adminAuditLog.count({
      where: { action: 'LOGIN_FAILED' },
    }),
    prisma.adminAuditLog.count({
      where: {
        action: { in: ['CREATE_ADMIN', 'DELETE_ADMIN', 'UPDATE_ADMIN'] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: {
      failedLogins,
      recentAdminChanges,
    },
  };
}

function ActionBadge({ action }: { action: string }) {
  const getStyles = (action: string) => {
    if (action.includes('FAILED')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('MFA')) return 'bg-purple-100 text-purple-800';
    if (action.includes('API_KEY')) return 'bg-orange-100 text-orange-800';
    return 'bg-neutral-100 text-neutral-800';
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStyles(action)}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export default async function SecurityLogsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const data = await getSecurityLogs(page);

  return (
    <AdminLayout
      title="Security Logs"
      description="Security audit trail and events"
    >
      <div className="mb-6">
        <Link href="/admin/logs" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Logs
        </Link>
      </div>

      {/* Security Summary */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Security Events</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">{data.total}</p>
        </div>
        <div className={`rounded-xl border p-6 ${
          data.stats.failedLogins > 10 ? 'bg-red-50 border-red-200' : 'bg-white border-neutral-200'
        }`}>
          <h3 className={`text-sm font-medium ${data.stats.failedLogins > 10 ? 'text-red-800' : 'text-neutral-600'}`}>
            Failed Login Attempts
          </h3>
          <p className={`text-2xl font-semibold mt-2 ${data.stats.failedLogins > 10 ? 'text-red-900' : 'text-neutral-900'}`}>
            {data.stats.failedLogins}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Admin Changes (7d)</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">{data.stats.recentAdminChanges}</p>
        </div>
      </div>

      {/* Security Alert */}
      {data.stats.failedLogins > 10 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-red-900">High number of failed login attempts detected</p>
              <p className="text-sm text-red-700">Review the security logs for potential brute force attacks.</p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                  No security events found
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {log.adminUser ? (
                      <div>
                        <div className="text-neutral-900">{log.adminUser.name || log.adminUser.email}</div>
                        {log.adminUser.name && (
                          <div className="text-neutral-500 text-xs">{log.adminUser.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-500">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-600">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 max-w-xs truncate">
                    {log.details ? (
                      <span className="font-mono text-xs">
                        {JSON.stringify(JSON.parse(log.details)).slice(0, 60)}
                      </span>
                    ) : (
                      '-'
                    )}
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
                href={`/admin/logs/security?page=${data.page - 1}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={`/admin/logs/security?page=${data.page + 1}`}
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
