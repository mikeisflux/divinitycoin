// app/admin/reports/revenue/page.tsx
// Revenue report with detailed breakdown

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getRevenueData() {
  const now = new Date();
  const periods = [];

  // Get last 12 months of data
  for (let i = 0; i < 12; i++) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const [purchases, refunds] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: 'PURCHASE',
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: {
          type: 'REFUND',
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    periods.push({
      month: startOfMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      grossRevenue: purchases._sum.amount || 0,
      refunds: refunds._sum.amount || 0,
      netRevenue: (purchases._sum.amount || 0) - (refunds._sum.amount || 0),
      transactions: purchases._count,
      refundCount: refunds._count,
    });
  }

  // Get totals
  const [totalPurchases, totalRefunds] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'REFUND', status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    periods: periods.reverse(),
    totals: {
      grossRevenue: totalPurchases._sum.amount || 0,
      refunds: totalRefunds._sum.amount || 0,
      netRevenue: (totalPurchases._sum.amount || 0) - (totalRefunds._sum.amount || 0),
      transactions: totalPurchases._count,
    },
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function RevenueReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getRevenueData();

  return (
    <AdminLayout
      title="Revenue Report"
      description="Detailed revenue breakdown by period"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Gross Revenue</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.totals.grossRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Refunds</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {formatCurrency(data.totals.refunds)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Net Revenue</h3>
          <p className="text-2xl font-semibold text-green-600 mt-2">
            {formatCurrency(data.totals.netRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Transactions</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.totals.transactions.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Month</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Gross Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Refunds</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Net Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Transactions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Refund Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.periods.map((period) => (
                <tr key={period.month} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{period.month}</td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-900">
                    {formatCurrency(period.grossRevenue)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">
                    {period.refunds > 0 ? `-${formatCurrency(period.refunds)}` : '$0.00'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                    {formatCurrency(period.netRevenue)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{period.transactions}</td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{period.refundCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-8 flex justify-end gap-3">
        <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
          Export CSV
        </button>
        <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
          Export Excel
        </button>
      </div>
    </AdminLayout>
  );
}
