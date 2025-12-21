// app/admin/settlements/page.tsx
// Admin settlement list page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { getSettlements, getSettlementStats } from '@/lib/settlements';
import { SettlementStatus } from '@prisma/client';
import Link from 'next/link';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getStatusBadgeClass(status: SettlementStatus): string {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED': return 'bg-blue-100 text-blue-800';
    case 'PROCESSING': return 'bg-purple-100 text-purple-800';
    case 'FAILED': return 'bg-red-100 text-red-800';
    case 'DISPUTED': return 'bg-orange-100 text-orange-800';
    default: return 'bg-neutral-100 text-neutral-800';
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string; partner?: string; page?: string }>;
}

export default async function SettlementsPage({ searchParams }: PageProps) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const params = await searchParams;
  const status = params.status as SettlementStatus | undefined;
  const partnerId = params.partner;
  const page = parseInt(params.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const [{ settlements, total }, stats] = await Promise.all([
    getSettlements({
      status,
      partnerId,
      limit,
      offset,
    }),
    getSettlementStats(),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout
      title="Settlements"
      description="Manage partner settlements and payouts"
    >
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Pending</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {formatCurrency(stats.totalPending)}
          </p>
          <p className="text-xs text-neutral-400">{stats.pendingCount} settlements</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Paid This Month</p>
          <p className="text-2xl font-semibold text-green-600">
            {formatCurrency(stats.totalPaidThisMonth)}
          </p>
          <p className="text-xs text-neutral-400">{stats.paidCountThisMonth} settlements</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Paid This Year</p>
          <p className="text-2xl font-semibold text-primary-600">
            {formatCurrency(stats.totalPaidThisYear)}
          </p>
          <p className="text-xs text-neutral-400">{stats.paidCountThisYear} settlements</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Total Settlements</p>
          <p className="text-2xl font-semibold text-neutral-900">{total}</p>
          <p className="text-xs text-neutral-400">all time</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/settlements"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!status ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            All
          </Link>
          {Object.values(SettlementStatus).map(s => (
            <Link
              key={s}
              href={`/admin/settlements?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${status === s ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Partner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Period</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Gross</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Fee</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Net</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase">Captures</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {settlements.map(s => (
              <tr key={s.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{s.partnerName}</td>
                <td className="px-4 py-3 text-sm text-neutral-600">
                  {s.periodStart.toLocaleDateString()} - {s.periodEnd.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-right text-neutral-900">{formatCurrency(s.grossAmount)}</td>
                <td className="px-4 py-3 text-sm text-right text-neutral-500">{formatCurrency(s.partnerFee)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-neutral-900">{formatCurrency(s.netAmount)}</td>
                <td className="px-4 py-3 text-sm text-center text-neutral-600">{s.captureCount}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(s.status)}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/settlements/${s.id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {settlements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  No settlements found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/settlements?page=${page - 1}${status ? `&status=${status}` : ''}`}
                  className="px-3 py-1 bg-white border border-neutral-300 rounded text-sm hover:bg-neutral-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/settlements?page=${page + 1}${status ? `&status=${status}` : ''}`}
                  className="px-3 py-1 bg-white border border-neutral-300 rounded text-sm hover:bg-neutral-50"
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
