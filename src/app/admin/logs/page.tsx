// app/admin/logs/page.tsx
// System logs page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getRecentLogs() {
  const [auditLogs, redemptionAttempts] = await Promise.all([
    prisma.adminAuditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.redemptionAttempt.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { auditLogs, redemptionAttempts };
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    LOGIN_SUCCESS: 'bg-green-100 text-green-800',
    LOGIN_FAILED: 'bg-red-100 text-red-800',
    LOGOUT: 'bg-neutral-100 text-neutral-800',
    CONFIG_UPDATE: 'bg-blue-100 text-blue-800',
    CONFIG_DELETE: 'bg-orange-100 text-orange-800',
    PARTNER_CREATE: 'bg-purple-100 text-purple-800',
    GIFTCARD_GENERATE: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[action] || 'bg-neutral-100 text-neutral-800'}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export default async function LogsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const { auditLogs, redemptionAttempts } = await getRecentLogs();

  const logCategories = [
    { name: 'Audit Logs', description: 'Admin actions and changes', href: '/admin/logs/audit', count: auditLogs.length },
    { name: 'API Logs', description: 'API request history', href: '/admin/logs/api', count: 0 },
    { name: 'Error Logs', description: 'System errors and exceptions', href: '/admin/logs/errors', count: 0 },
    { name: 'Security Logs', description: 'Authentication and access events', href: '/admin/logs/security', count: 0 },
  ];

  return (
    <AdminLayout
      title="System Logs"
      description="Monitor system activity and events"
    >
      {/* Log Categories */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {logCategories.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <h3 className="font-medium text-neutral-900">{category.name}</h3>
            <p className="text-sm text-neutral-500 mt-1">{category.description}</p>
          </Link>
        ))}
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">Recent Admin Activity</h3>
          <Link href="/admin/logs/audit" className="text-sm text-primary-600 hover:underline">
            View All
          </Link>
        </div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                  No audit logs yet
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {log.admin?.name || log.admin?.email || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {log.resource}
                    {log.resourceId && ` (${log.resourceId.slice(0, 8)}...)`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 font-mono">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Redemption Attempts */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Recent Redemption Attempts</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Code (Last 4)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Result</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {redemptionAttempts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                  No redemption attempts yet
                </td>
              </tr>
            ) : (
              redemptionAttempts.map((attempt) => (
                <tr key={attempt.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-900">
                    ****{attempt.codeLast4}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      attempt.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {attempt.success ? 'SUCCESS' : attempt.errorCode || 'FAILED'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 font-mono">
                    {attempt.ipAddress || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(attempt.createdAt).toLocaleString()}
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
