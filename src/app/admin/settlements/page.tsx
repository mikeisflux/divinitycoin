// app/admin/settlements/page.tsx
// Settlement management page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SettlementStatus } from '@prisma/client';

interface SearchParams {
  status?: string;
  partner?: string;
  page?: string;
}

async function getSettlements(params: SearchParams) {
  const page = parseInt(params.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const where: {
    status?: SettlementStatus;
    partnerId?: string;
  } = {};

  if (params.status && Object.values(SettlementStatus).includes(params.status as SettlementStatus)) {
    where.status = params.status as SettlementStatus;
  }

  if (params.partner) {
    where.partnerId = params.partner;
  }

  const [settlements, total, stats] = await Promise.all([
    prisma.partnerSettlement.findMany({
      where,
      include: {
        partner: { select: { name: true } },
        _count: { select: { captures: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.partnerSettlement.count({ where }),
    getSettlementStats(),
  ]);

  return { settlements, total, page, limit, stats };
}

async function getSettlementStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const startOfYear = new Date(now.getUTCFullYear(), 0, 1);

  const [pending, paidThisMonth, paidThisYear] = await Promise.all([
    prisma.partnerSettlement.aggregate({
      where: { status: SettlementStatus.PENDING },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.partnerSettlement.aggregate({
      where: {
        status: SettlementStatus.PAID,
        paidAt: { gte: startOfMonth },
      },
      _sum: { netAmount: true },
    }),
    prisma.partnerSettlement.aggregate({
      where: {
        status: SettlementStatus.PAID,
        paidAt: { gte: startOfYear },
      },
      _sum: { netAmount: true },
    }),
  ]);

  return {
    totalPending: Number(pending._sum.netAmount ?? 0),
    pendingCount: pending._count,
    totalPaidThisMonth: Number(paidThisMonth._sum.netAmount ?? 0),
    totalPaidThisYear: Number(paidThisYear._sum.netAmount ?? 0),
  };
}

async function getPartners() {
  return prisma.partner.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function StatusBadge({ status }: { status: SettlementStatus }) {
  const styles: Record<SettlementStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    PAID: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    DISPUTED: 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
      {subValue && <p className="text-sm text-neutral-500 mt-1">{subValue}</p>}
    </div>
  );
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const params = await searchParams;
  const { settlements, total, page, limit, stats } = await getSettlements(params);
  const partners = await getPartners();
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout
      title="Settlements"
      description="Manage partner settlements and payouts"
      actions={
        <Link
          href="/admin/settings/settlements"
          className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Pending Settlements"
          value={formatCurrency(stats.totalPending)}
          subValue={`${stats.pendingCount} settlements`}
        />
        <StatCard
          label="Paid This Month"
          value={formatCurrency(stats.totalPaidThisMonth)}
        />
        <StatCard
          label="Paid This Year"
          value={formatCurrency(stats.totalPaidThisYear)}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
        <form className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
            <select
              name="status"
              defaultValue={params.status || ''}
              className="block w-40 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Statuses</option>
              {Object.values(SettlementStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Partner</label>
            <select
              name="partner"
              defaultValue={params.partner || ''}
              className="block w-48 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Partners</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
            >
              Filter
            </button>
          </div>
          {(params.status || params.partner) && (
            <div className="flex items-end">
              <Link
                href="/admin/settlements"
                className="px-4 py-2 text-neutral-600 hover:text-neutral-900 text-sm"
              >
                Clear filters
              </Link>
            </div>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Partner
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Period
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Captures
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Gross
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Fee
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Net
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-neutral-500">
                  No settlements found.
                </td>
              </tr>
            ) : (
              settlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-neutral-900">{settlement.partner.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {formatDateRange(settlement.periodStart, settlement.periodEnd)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {settlement._count.captures}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {formatCurrency(Number(settlement.grossAmount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    -{formatCurrency(Number(settlement.partnerFee))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {formatCurrency(Number(settlement.netAmount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={settlement.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/settlements/${settlement.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} settlements
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/settlements?page=${page - 1}${params.status ? `&status=${params.status}` : ''}${params.partner ? `&partner=${params.partner}` : ''}`}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm hover:bg-neutral-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/settlements?page=${page + 1}${params.status ? `&status=${params.status}` : ''}${params.partner ? `&partner=${params.partner}` : ''}`}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm hover:bg-neutral-50"
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
