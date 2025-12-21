// app/admin/reports/sales/page.tsx
// Sales analytics report

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getSalesData() {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get transactions by amount tier
  const amountTiers = [
    { label: '$5 - $10', min: 5, max: 10 },
    { label: '$11 - $25', min: 11, max: 25 },
    { label: '$26 - $50', min: 26, max: 50 },
    { label: '$51 - $100', min: 51, max: 100 },
    { label: '$101 - $250', min: 101, max: 250 },
    { label: '$251 - $500', min: 251, max: 500 },
  ];

  const tierData = await Promise.all(
    amountTiers.map(async (tier) => {
      const result = await prisma.transaction.aggregate({
        where: {
          type: 'PURCHASE',
          status: 'COMPLETED',
          amount: { gte: tier.min, lte: tier.max },
        },
        _count: true,
        _sum: { amount: true },
      });
      return {
        ...tier,
        count: result._count,
        total: Number(result._sum.amount) || 0,
      };
    })
  );

  // Get daily sales for last 30 days
  const dailySales = await prisma.$queryRaw<Array<{ date: Date; count: bigint; total: number }>>`
    SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'PURCHASE' AND status = 'COMPLETED' AND created_at >= ${last30Days}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  // Get top customers
  const topCustomers = await prisma.transaction.groupBy({
    by: ['guestEmail'],
    where: { type: 'PURCHASE', status: 'COMPLETED' },
    _count: true,
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  });

  // Get summary stats
  const [last7DaysSales, last30DaysSales, avgTransactionValue] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: last7Days } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: last30Days } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _avg: { amount: true },
    }),
  ]);

  return {
    tierData,
    dailySales: dailySales.map(d => ({
      date: d.date,
      count: Number(d.count),
      total: Number(d.total),
    })),
    topCustomers: topCustomers.map(c => ({
      email: c.guestEmail || 'Unknown',
      purchases: c._count,
      totalSpent: Number(c._sum.amount) || 0,
    })),
    summary: {
      last7Days: { amount: Number(last7DaysSales._sum.amount) || 0, count: last7DaysSales._count },
      last30Days: { amount: Number(last30DaysSales._sum.amount) || 0, count: last30DaysSales._count },
      avgValue: Number(avgTransactionValue._avg.amount) || 0,
    },
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default async function SalesReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getSalesData();

  return (
    <AdminLayout
      title="Sales Report"
      description="Transaction and sales analytics"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Last 7 Days</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.summary.last7Days.amount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.last7Days.count} transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Last 30 Days</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.summary.last30Days.amount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.last30Days.count} transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Avg Transaction Value</h3>
          <p className="text-2xl font-semibold text-primary-600 mt-2">
            {formatCurrency(data.summary.avgValue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Daily Avg (30d)</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.summary.last30Days.amount / 30)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales by Amount Tier */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Sales by Amount</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.tierData.map((tier) => (
              <div key={tier.label} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{tier.label}</p>
                  <p className="text-sm text-neutral-500">{tier.count} purchases</p>
                </div>
                <p className="font-semibold text-neutral-900">{formatCurrency(tier.total)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Top Customers</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.topCustomers.slice(0, 8).map((customer, i) => (
              <div key={customer.email} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-neutral-900">{customer.email}</p>
                    <p className="text-sm text-neutral-500">{customer.purchases} purchases</p>
                  </div>
                </div>
                <p className="font-semibold text-neutral-900">{formatCurrency(customer.totalSpent)}</p>
              </div>
            ))}
          </div>
        </div>
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
