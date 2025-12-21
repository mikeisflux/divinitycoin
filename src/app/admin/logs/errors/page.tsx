// app/admin/logs/errors/page.tsx
// Error logs viewer

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getErrorLogs(page: number = 1) {
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Get failed transactions as error indicators
  const [transactions, emails, redemptions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.emailLog.findMany({
      where: { status: { in: ['FAILED', 'BOUNCED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.redemptionAttempt.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.transaction.count({ where: { status: 'FAILED' } }),
  ]);

  // Combine and sort errors
  const errors = [
    ...transactions.map((t) => ({
      id: t.id,
      type: 'TRANSACTION',
      message: `Transaction failed: ${t.guestEmail || 'Unknown'}`,
      details: `Amount: $${Number(t.amount)}, Status: ${t.status}`,
      createdAt: t.createdAt,
    })),
    ...emails.map((e) => ({
      id: e.id,
      type: 'EMAIL',
      message: `Email ${e.status.toLowerCase()}: ${e.toEmail}`,
      details: `Subject: ${e.subject}`,
      createdAt: e.createdAt,
    })),
    ...redemptions.map((r) => ({
      id: r.id,
      type: 'REDEMPTION',
      message: `Failed redemption attempt`,
      details: `IP: ${r.ipAddress}, Error: ${r.errorCode || 'Unknown'}`,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    errors: errors.slice(skip, skip + pageSize),
    total: errors.length,
    page,
    pageSize,
    totalPages: Math.ceil(errors.length / pageSize),
  };
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    TRANSACTION: 'bg-red-100 text-red-800',
    EMAIL: 'bg-orange-100 text-orange-800',
    REDEMPTION: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-neutral-100 text-neutral-800'}`}>
      {type}
    </span>
  );
}

export default async function ErrorLogsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const data = await getErrorLogs(page);

  return (
    <AdminLayout
      title="Error Logs"
      description={`${data.total} errors recorded`}
    >
      <div className="mb-6">
        <Link href="/admin/logs" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Logs
        </Link>
      </div>

      {/* Error Summary */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <h3 className="text-sm font-medium text-red-800">Transaction Errors</h3>
          <p className="text-2xl font-semibold text-red-900 mt-2">
            {data.errors.filter((e) => e.type === 'TRANSACTION').length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
          <h3 className="text-sm font-medium text-orange-800">Email Errors</h3>
          <p className="text-2xl font-semibold text-orange-900 mt-2">
            {data.errors.filter((e) => e.type === 'EMAIL').length}
          </p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
          <h3 className="text-sm font-medium text-yellow-800">Redemption Errors</h3>
          <p className="text-2xl font-semibold text-yellow-900 mt-2">
            {data.errors.filter((e) => e.type === 'REDEMPTION').length}
          </p>
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Message</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.errors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                  No errors found - great news!
                </td>
              </tr>
            ) : (
              data.errors.map((error) => (
                <tr key={`${error.type}-${error.id}`} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(error.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TypeBadge type={error.type} />
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-900">
                    {error.message}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 max-w-xs truncate">
                    {error.details}
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
                href={`/admin/logs/errors?page=${data.page - 1}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={`/admin/logs/errors?page=${data.page + 1}`}
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
