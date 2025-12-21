// app/admin/reports/refunds/page.tsx
// Refund history and analysis report

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getRefundData() {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get refund stats
  const [
    totalRefunds,
    last30DaysRefunds,
    totalPurchases,
    last30DaysPurchases,
    refundsByMonth,
    recentRefunds,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'REFUND', status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'REFUND', status: 'COMPLETED', createdAt: { gte: last30Days } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: last30Days } },
      _sum: { amount: true },
      _count: true,
    }),
    // Get monthly refunds for last 6 months
    prisma.$queryRaw<Array<{ month: string; count: bigint; total: number }>>`
      SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
             COUNT(*) as count,
             COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'REFUND' AND status = 'COMPLETED' AND created_at >= ${last90Days}
      GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
      LIMIT 6
    `,
    prisma.transaction.findMany({
      where: { type: 'REFUND', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        email: true,
        createdAt: true,
        stripePaymentIntentId: true,
        giftCard: {
          select: { codeLast4: true, purchaserEmail: true },
        },
      },
    }),
  ]);

  // Calculate refund rate
  const totalRefundAmount = totalRefunds._sum.amount || 0;
  const totalPurchaseAmount = totalPurchases._sum.amount || 0;
  const refundRate = totalPurchaseAmount > 0 ? (totalRefundAmount / totalPurchaseAmount) * 100 : 0;

  const last30DaysRefundAmount = last30DaysRefunds._sum.amount || 0;
  const last30DaysPurchaseAmount = last30DaysPurchases._sum.amount || 0;
  const last30DaysRefundRate = last30DaysPurchaseAmount > 0
    ? (last30DaysRefundAmount / last30DaysPurchaseAmount) * 100
    : 0;

  return {
    summary: {
      totalRefunds: totalRefundAmount,
      totalRefundCount: totalRefunds._count,
      last30DaysRefunds: last30DaysRefundAmount,
      last30DaysCount: last30DaysRefunds._count,
      overallRefundRate: refundRate,
      last30DaysRefundRate,
      avgRefundAmount: totalRefunds._count > 0 ? totalRefundAmount / totalRefunds._count : 0,
    },
    byMonth: refundsByMonth.map(m => ({
      month: m.month,
      count: Number(m.count),
      total: Number(m.total),
    })),
    recent: recentRefunds.map(r => ({
      id: r.id,
      amount: r.amount,
      email: r.email || r.giftCard?.purchaserEmail || 'Unknown',
      createdAt: r.createdAt,
      cardLast4: r.giftCard?.codeLast4 || 'N/A',
    })),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function RefundsReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getRefundData();

  return (
    <AdminLayout
      title="Refund Report"
      description="Refund history and analysis"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Refunds</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {formatCurrency(data.summary.totalRefunds)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.totalRefundCount} refunds</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Last 30 Days</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {formatCurrency(data.summary.last30DaysRefunds)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.last30DaysCount} refunds</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Overall Refund Rate</h3>
          <p className={`text-2xl font-semibold mt-2 ${
            data.summary.overallRefundRate > 5 ? 'text-red-600' : 'text-green-600'
          }`}>
            {data.summary.overallRefundRate.toFixed(2)}%
          </p>
          <p className="text-sm text-neutral-500 mt-1">of total sales</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Avg Refund Amount</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.summary.avgRefundAmount)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Monthly Trend */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Monthly Trend</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.byMonth.length > 0 ? data.byMonth.map((month) => (
              <div key={month.month} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{month.month}</p>
                  <p className="text-sm text-neutral-500">{month.count} refunds</p>
                </div>
                <p className="font-semibold text-red-600">{formatCurrency(month.total)}</p>
              </div>
            )) : (
              <div className="p-8 text-center text-neutral-500">No refund data</div>
            )}
          </div>
        </div>

        {/* Recent Refunds */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Recent Refunds</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Card</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {data.recent.length > 0 ? data.recent.map((refund) => (
                  <tr key={refund.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(refund.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{refund.email}</td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-600">****{refund.cardLast4}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-red-600">
                      {formatCurrency(Number(refund.amount))}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                      No refunds found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Health Indicator */}
      <div className={`rounded-xl border p-6 ${
        data.summary.overallRefundRate > 5
          ? 'bg-red-50 border-red-200'
          : data.summary.overallRefundRate > 2
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
      }`}>
        <h3 className={`font-semibold ${
          data.summary.overallRefundRate > 5
            ? 'text-red-900'
            : data.summary.overallRefundRate > 2
              ? 'text-amber-900'
              : 'text-green-900'
        }`}>
          {data.summary.overallRefundRate > 5
            ? '⚠️ High Refund Rate Alert'
            : data.summary.overallRefundRate > 2
              ? '⚡ Moderate Refund Rate'
              : '✓ Healthy Refund Rate'}
        </h3>
        <p className={`text-sm mt-1 ${
          data.summary.overallRefundRate > 5
            ? 'text-red-700'
            : data.summary.overallRefundRate > 2
              ? 'text-amber-700'
              : 'text-green-700'
        }`}>
          {data.summary.overallRefundRate > 5
            ? 'Your refund rate is above 5%. Consider reviewing refund patterns and customer feedback.'
            : data.summary.overallRefundRate > 2
              ? 'Your refund rate is moderate. Keep monitoring for any concerning trends.'
              : 'Your refund rate is healthy and within normal limits.'}
        </p>
      </div>

      {/* Export */}
      <div className="mt-8 flex justify-end gap-3">
        <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
          Export CSV
        </button>
      </div>
    </AdminLayout>
  );
}
