// app/admin/page.tsx
// Admin dashboard

import { prisma } from '@/lib/db';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';

async function getDashboardStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalRevenue,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    activeCards,
    totalCards,
    redeemedCards,
    totalUsers,
    activePartners,
    failedTransactions,
    recentTransactions,
    recentRedemptions,
  ] = await Promise.all([
    // Total revenue
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    // Today's revenue
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: startOfToday } },
      _sum: { amount: true },
    }),
    // This week's revenue
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: startOfWeek } },
      _sum: { amount: true },
    }),
    // This month's revenue
    prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    // Active gift cards
    prisma.giftCard.count({ where: { status: 'ACTIVE' } }),
    // Total gift cards
    prisma.giftCard.count(),
    // Redeemed gift cards
    prisma.giftCard.count({ where: { status: 'REDEEMED' } }),
    // Total users
    prisma.user.count(),
    // Active partners
    prisma.partner.count({ where: { status: 'ACTIVE' } }),
    // Failed transactions (last 24 hours)
    prisma.transaction.count({
      where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    // Recent transactions
    prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { giftCard: true },
    }),
    // Recent redemptions
    prisma.giftCard.findMany({
      where: { status: 'REDEEMED' },
      take: 5,
      orderBy: { redeemedAt: 'desc' },
    }),
  ]);

  const redemptionRate = totalCards > 0 ? (redeemedCards / totalCards) * 100 : 0;

  return {
    totalRevenue: totalRevenue._sum.amount || 0,
    todayRevenue: todayRevenue._sum.amount || 0,
    weekRevenue: weekRevenue._sum.amount || 0,
    monthRevenue: monthRevenue._sum.amount || 0,
    activeCards,
    totalCards,
    redeemedCards,
    redemptionRate,
    totalUsers,
    activePartners,
    failedTransactions,
    recentTransactions,
    recentRedemptions,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function StatCard({ title, value, subtext, alert }: { title: string; value: string; subtext?: string; alert?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-6 border ${alert ? 'border-red-200' : 'border-neutral-200'}`}>
      <h3 className="text-sm font-medium text-neutral-600">{title}</h3>
      <p className={`text-2xl font-semibold mt-2 ${alert ? 'text-red-600' : 'text-neutral-900'}`}>{value}</p>
      {subtext && <p className="text-sm text-neutral-500 mt-1">{subtext}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const stats = await getDashboardStats();

  return (
    <AdminLayout title="Dashboard" description={`Welcome back, ${admin.name}`}>
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtext="All time"
        />
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
        />
        <StatCard
          title="This Week"
          value={formatCurrency(stats.weekRevenue)}
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats.monthRevenue)}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Gift Cards"
          value={stats.activeCards.toString()}
          subtext={`${stats.totalCards} total`}
        />
        <StatCard
          title="Redemption Rate"
          value={`${stats.redemptionRate.toFixed(1)}%`}
          subtext={`${stats.redeemedCards} redeemed`}
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toString()}
        />
        <StatCard
          title="Active Partners"
          value={stats.activePartners.toString()}
        />
      </div>

      {/* Alerts */}
      {stats.failedTransactions > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-red-800 font-medium">
              {stats.failedTransactions} failed transaction{stats.failedTransactions > 1 ? 's' : ''} in the last 24 hours
            </span>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent Transactions</h3>
          <div className="space-y-4">
            {stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {tx.type === 'PURCHASE' ? 'Purchase' : 'Refund'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${tx.type === 'REFUND' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'REFUND' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </p>
                    <p className={`text-xs ${tx.status === 'COMPLETED' ? 'text-green-600' : tx.status === 'FAILED' ? 'text-red-600' : 'text-neutral-500'}`}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 text-sm">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Recent Redemptions */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent Redemptions</h3>
          <div className="space-y-4">
            {stats.recentRedemptions.length > 0 ? (
              stats.recentRedemptions.map((card) => (
                <div key={card.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      ****{card.codeLast4}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {card.redeemedAt ? new Date(card.redeemedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-900">
                      {formatCurrency(card.amount)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {card.redeemedByEmail || 'Unknown'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 text-sm">No redemptions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="/admin/gift-cards/generate"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Generate Gift Card
          </a>
          <a
            href="/admin/partners/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
          >
            Add Partner
          </a>
          <a
            href="/admin/reports"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
          >
            View Reports
          </a>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
          >
            Stripe Dashboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
