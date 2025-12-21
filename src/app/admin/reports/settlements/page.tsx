// app/admin/reports/settlements/page.tsx
// Settlement report with detailed breakdown

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SettlementStatus } from '@prisma/client';

async function getSettlementData() {
  const now = new Date();
  const periods = [];

  // Get last 12 months of data
  for (let i = 0; i < 12; i++) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const [paid, pending, failed] = await Promise.all([
      prisma.partnerSettlement.aggregate({
        where: {
          status: SettlementStatus.PAID,
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true, partnerFee: true, grossAmount: true },
        _count: true,
      }),
      prisma.partnerSettlement.aggregate({
        where: {
          status: SettlementStatus.PENDING,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.partnerSettlement.aggregate({
        where: {
          status: SettlementStatus.FAILED,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    periods.push({
      month: startOfMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      paidAmount: Number(paid._sum.netAmount) || 0,
      paidCount: paid._count,
      feeRevenue: Number(paid._sum.partnerFee) || 0,
      grossAmount: Number(paid._sum.grossAmount) || 0,
      pendingAmount: Number(pending._sum.netAmount) || 0,
      pendingCount: pending._count,
      failedAmount: Number(failed._sum.netAmount) || 0,
      failedCount: failed._count,
    });
  }

  // Get overall totals
  const [totalPaid, totalPending, totalFailed, byPartner, byStatus] = await Promise.all([
    prisma.partnerSettlement.aggregate({
      where: { status: SettlementStatus.PAID },
      _sum: { netAmount: true, partnerFee: true, grossAmount: true },
      _count: true,
    }),
    prisma.partnerSettlement.aggregate({
      where: { status: SettlementStatus.PENDING },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.partnerSettlement.aggregate({
      where: { status: SettlementStatus.FAILED },
      _sum: { netAmount: true },
      _count: true,
    }),
    // Top partners by settlement volume
    prisma.partnerSettlement.groupBy({
      by: ['partnerId'],
      where: { status: SettlementStatus.PAID },
      _sum: { netAmount: true, partnerFee: true },
      _count: true,
      orderBy: { _sum: { netAmount: 'desc' } },
      take: 10,
    }),
    // Count by status
    prisma.partnerSettlement.groupBy({
      by: ['status'],
      _count: true,
      _sum: { netAmount: true },
    }),
  ]);

  // Get partner names for top partners
  const partnerIds = byPartner.map(p => p.partnerId);
  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true },
  });

  const partnerMap = new Map(partners.map(p => [p.id, p.name]));

  return {
    periods: periods.reverse(),
    totals: {
      paidAmount: Number(totalPaid._sum.netAmount) || 0,
      paidCount: totalPaid._count,
      feeRevenue: Number(totalPaid._sum.partnerFee) || 0,
      grossAmount: Number(totalPaid._sum.grossAmount) || 0,
      pendingAmount: Number(totalPending._sum.netAmount) || 0,
      pendingCount: totalPending._count,
      failedAmount: Number(totalFailed._sum.netAmount) || 0,
      failedCount: totalFailed._count,
    },
    byPartner: byPartner.map(p => ({
      partnerId: p.partnerId,
      partnerName: partnerMap.get(p.partnerId) || 'Unknown',
      netAmount: Number(p._sum.netAmount) || 0,
      feeAmount: Number(p._sum.partnerFee) || 0,
      count: p._count,
    })),
    byStatus: byStatus.map(s => ({
      status: s.status,
      count: s._count,
      amount: Number(s._sum.netAmount) || 0,
    })),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PAID': return 'text-green-600';
    case 'PENDING': return 'text-amber-600';
    case 'APPROVED': return 'text-blue-600';
    case 'PROCESSING': return 'text-purple-600';
    case 'FAILED': return 'text-red-600';
    case 'DISPUTED': return 'text-orange-600';
    default: return 'text-neutral-600';
  }
}

export default async function SettlementReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getSettlementData();

  return (
    <AdminLayout
      title="Settlement Report"
      description="Partner settlement analytics and breakdown"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Paid Out</h3>
          <p className="text-2xl font-semibold text-green-600 mt-2">
            {formatCurrency(data.totals.paidAmount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.totals.paidCount} settlements
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Fee Revenue</h3>
          <p className="text-2xl font-semibold text-primary-600 mt-2">
            {formatCurrency(data.totals.feeRevenue)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Platform earnings
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Pending Payouts</h3>
          <p className="text-2xl font-semibold text-amber-600 mt-2">
            {formatCurrency(data.totals.pendingAmount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.totals.pendingCount} awaiting action
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Failed Payments</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {formatCurrency(data.totals.failedAmount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.totals.failedCount} failed
          </p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Settlement Status</h2>
          <div className="space-y-3">
            {data.byStatus.map(s => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${getStatusColor(s.status)}`}>{s.status}</span>
                  <span className="text-sm text-neutral-500">({s.count})</span>
                </div>
                <span className="font-medium text-neutral-900">{formatCurrency(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Top Partners</h2>
          <div className="space-y-3">
            {data.byPartner.slice(0, 5).map((p, i) => (
              <div key={p.partnerId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500">{i + 1}.</span>
                  <span className="font-medium text-neutral-900">{p.partnerName}</span>
                  <span className="text-sm text-neutral-500">({p.count} settlements)</span>
                </div>
                <span className="font-medium text-neutral-900">{formatCurrency(p.netAmount)}</span>
              </div>
            ))}
            {data.byPartner.length === 0 && (
              <p className="text-neutral-500 text-sm">No settlements yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Month</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Gross Volume</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Fees Collected</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Net Paid Out</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Paid</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Pending</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.periods.map((period) => (
                <tr key={period.month} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{period.month}</td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-900">
                    {formatCurrency(period.grossAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-primary-600">
                    {formatCurrency(period.feeRevenue)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                    {formatCurrency(period.paidAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{period.paidCount}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-600">{period.pendingCount}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">{period.failedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Partners Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Partner Settlement Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Partner</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Settlements</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Net Paid</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Fees Paid</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Avg Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.byPartner.map((partner) => (
                <tr key={partner.partnerId} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                    <Link
                      href={`/admin/partners/${partner.partnerId}`}
                      className="text-primary-600 hover:underline"
                    >
                      {partner.partnerName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{partner.count}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-neutral-900">
                    {formatCurrency(partner.netAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-primary-600">
                    {formatCurrency(partner.feeAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">
                    {formatCurrency(partner.count > 0 ? partner.netAmount / partner.count : 0)}
                  </td>
                </tr>
              ))}
              {data.byPartner.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                    No settlement data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          href="/admin/settlements"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          View All Settlements →
        </Link>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
            Export CSV
          </button>
          <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
            Export Excel
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
