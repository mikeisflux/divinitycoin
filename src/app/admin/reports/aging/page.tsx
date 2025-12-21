// app/admin/reports/aging/page.tsx
// Unredeemed gift cards aging report

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getAgingData() {
  const now = new Date();

  // Define aging buckets
  const buckets = [
    { label: '0-7 days', minDays: 0, maxDays: 7 },
    { label: '8-30 days', minDays: 8, maxDays: 30 },
    { label: '31-90 days', minDays: 31, maxDays: 90 },
    { label: '91-180 days', minDays: 91, maxDays: 180 },
    { label: '181-365 days', minDays: 181, maxDays: 365 },
    { label: 'Over 1 year', minDays: 366, maxDays: 9999 },
  ];

  const bucketData = await Promise.all(
    buckets.map(async (bucket) => {
      const minDate = new Date(now.getTime() - bucket.maxDays * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() - bucket.minDays * 24 * 60 * 60 * 1000);

      const result = await prisma.giftCard.aggregate({
        where: {
          status: 'ACTIVE',
          createdAt: { gte: minDate, lt: maxDate },
        },
        _count: true,
        _sum: { amount: true },
      });

      return {
        ...bucket,
        count: result._count,
        totalValue: result._sum.amount || 0,
      };
    })
  );

  // Get overall unredeemed stats
  const [totalUnredeemed, expiringIn30Days, oldestUnredeemed] = await Promise.all([
    prisma.giftCard.aggregate({
      where: { status: 'ACTIVE' },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.giftCard.aggregate({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.giftCard.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, amount: true, codeLast4: true },
    }),
  ]);

  // Get top unredeemed by value
  const topUnredeemed = await prisma.giftCard.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { amount: 'desc' },
    take: 10,
    select: {
      id: true,
      codeLast4: true,
      amount: true,
      purchaserEmail: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return {
    buckets: bucketData,
    summary: {
      totalCount: totalUnredeemed._count,
      totalValue: totalUnredeemed._sum.amount || 0,
      expiringCount: expiringIn30Days._count,
      expiringValue: expiringIn30Days._sum.amount || 0,
      oldestCard: oldestUnredeemed,
    },
    topUnredeemed,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysOld(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
}

export default async function AgingReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getAgingData();

  return (
    <AdminLayout
      title="Gift Card Aging Report"
      description="Unredeemed cards by age"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Unredeemed</h3>
          <p className="text-2xl font-semibold text-amber-600 mt-2">
            {formatCurrency(data.summary.totalValue)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.totalCount} cards</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Expiring in 30 Days</h3>
          <p className="text-2xl font-semibold text-red-600 mt-2">
            {formatCurrency(data.summary.expiringValue)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{data.summary.expiringCount} cards</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Oldest Unredeemed</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.summary.oldestCard ? getDaysOld(data.summary.oldestCard.createdAt) : 0} days
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.summary.oldestCard ? formatCurrency(Number(data.summary.oldestCard.amount)) : '$0'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Avg Card Value</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.summary.totalCount > 0
              ? formatCurrency(data.summary.totalValue / data.summary.totalCount)
              : '$0'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Aging Buckets */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Cards by Age</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.buckets.map((bucket) => (
              <div key={bucket.label} className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-neutral-900">{bucket.label}</span>
                  <span className="font-semibold text-neutral-900">{formatCurrency(bucket.totalValue)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-500">
                  <span>{bucket.count} cards</span>
                  <span>
                    {data.summary.totalValue > 0
                      ? ((bucket.totalValue / data.summary.totalValue) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${data.summary.totalValue > 0
                        ? (bucket.totalValue / data.summary.totalValue) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Value Unredeemed */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Highest Value Unredeemed</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.topUnredeemed.length > 0 ? data.topUnredeemed.map((card) => (
              <div key={card.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-neutral-900">****{card.codeLast4}</p>
                  <p className="text-sm text-neutral-500">{card.purchaserEmail}</p>
                  <p className="text-xs text-neutral-400">{getDaysOld(card.createdAt)} days old</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900">{formatCurrency(Number(card.amount))}</p>
                  {card.expiresAt && (
                    <p className="text-xs text-neutral-500">Expires {formatDate(card.expiresAt)}</p>
                  )}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-neutral-500">No unredeemed cards</div>
            )}
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="mt-8 flex justify-end gap-3">
        <button className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
          Export CSV
        </button>
        <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition">
          Send Reminder Emails
        </button>
      </div>
    </AdminLayout>
  );
}
