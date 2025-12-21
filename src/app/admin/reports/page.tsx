// app/admin/reports/page.tsx
// Reports dashboard

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getReportData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    thisMonthRevenue,
    lastMonthRevenue,
    thisMonthTransactions,
    lastMonthTransactions,
    thisMonthRedemptions,
    lastMonthRedemptions,
    activeCards,
    unredeemedValue,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.transaction.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.giftCard.count({ where: { status: 'REDEEMED', redeemedAt: { gte: startOfMonth } } }),
    prisma.giftCard.count({ where: { status: 'REDEEMED', redeemedAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.giftCard.count({ where: { status: 'ACTIVE' } }),
    prisma.giftCard.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true },
    }),
  ]);

  return {
    thisMonthRevenue: thisMonthRevenue._sum.amount || 0,
    lastMonthRevenue: lastMonthRevenue._sum.amount || 0,
    thisMonthTransactions,
    lastMonthTransactions,
    thisMonthRedemptions,
    lastMonthRedemptions,
    activeCards,
    unredeemedValue: unredeemedValue._sum.amount || 0,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function calculateChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

export default async function ReportsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getReportData();

  const reportTypes = [
    { name: 'Revenue Report', description: 'Detailed revenue breakdown by period', href: '/admin/reports/revenue' },
    { name: 'Sales Report', description: 'Transaction and sales analytics', href: '/admin/reports/sales' },
    { name: 'Redemption Report', description: 'Gift card redemption patterns', href: '/admin/reports/redemptions' },
    { name: 'Partner Report', description: 'Partner activity and usage', href: '/admin/reports/partners' },
    { name: 'Gift Card Aging', description: 'Unredeemed cards by age', href: '/admin/reports/aging' },
    { name: 'Refund Report', description: 'Refund history and analysis', href: '/admin/reports/refunds' },
  ];

  return (
    <AdminLayout
      title="Reports"
      description="Analytics and reporting dashboard"
    >
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">This Month Revenue</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.thisMonthRevenue)}
          </p>
          <p className={`text-sm mt-1 ${data.thisMonthRevenue >= data.lastMonthRevenue ? 'text-green-600' : 'text-red-600'}`}>
            {calculateChange(data.thisMonthRevenue, data.lastMonthRevenue)} vs last month
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Transactions</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.thisMonthTransactions}
          </p>
          <p className={`text-sm mt-1 ${data.thisMonthTransactions >= data.lastMonthTransactions ? 'text-green-600' : 'text-red-600'}`}>
            {calculateChange(data.thisMonthTransactions, data.lastMonthTransactions)} vs last month
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Redemptions</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.thisMonthRedemptions}
          </p>
          <p className={`text-sm mt-1 ${data.thisMonthRedemptions >= data.lastMonthRedemptions ? 'text-green-600' : 'text-red-600'}`}>
            {calculateChange(data.thisMonthRedemptions, data.lastMonthRedemptions)} vs last month
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Unredeemed Value</h3>
          <p className="text-2xl font-semibold text-amber-600 mt-2">
            {formatCurrency(data.unredeemedValue)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.activeCards} active cards
          </p>
        </div>
      </div>

      {/* Report Types */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Available Reports</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <Link
              key={report.name}
              href={report.href}
              className="block p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition"
            >
              <h3 className="font-medium text-neutral-900">{report.name}</h3>
              <p className="text-sm text-neutral-500 mt-1">{report.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-8 bg-neutral-50 rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Export Data</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
            Export Transactions (CSV)
          </button>
          <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
            Export Gift Cards (CSV)
          </button>
          <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
            Export Users (CSV)
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
