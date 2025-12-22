// app/partners/dashboard/page.tsx
// Partner dashboard with settlements

import { getPartnerFromRequest } from '@/lib/partner/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getPartnerStats(partnerId: string) {
  const [apiKeys, activeApiKeys, settlements, paidSettlements] = await Promise.all([
    prisma.partnerApiKey.count({ where: { partnerId } }),
    prisma.partnerApiKey.count({ where: { partnerId, isActive: true } }),
    prisma.partnerSettlement.findMany({
      where: { partnerId },
      select: { netAmount: true, status: true },
    }),
    prisma.partnerSettlement.aggregate({
      where: { partnerId, status: 'PAID' },
      _sum: { netAmount: true },
    }),
  ]);

  // Get total API requests
  const keys = await prisma.partnerApiKey.findMany({
    where: { partnerId },
    select: { requestCount: true },
  });
  const totalRequests = keys.reduce((sum, k) => sum + Number(k.requestCount), 0);

  // Calculate settlement stats
  const totalPaid = Number(paidSettlements._sum.netAmount || 0);
  const pendingSettlements = settlements.filter(s => s.status === 'PENDING' || s.status === 'APPROVED');
  const pendingAmount = pendingSettlements.reduce((sum, s) => sum + Number(s.netAmount), 0);

  return {
    apiKeys,
    activeApiKeys,
    totalRequests,
    totalSettlements: settlements.length,
    totalPaid,
    pendingAmount,
    pendingCount: pendingSettlements.length,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function PartnerDashboard() {
  const partner = await getPartnerFromRequest();

  if (!partner) {
    redirect('/partners/login');
  }

  if (partner.partnerStatus !== 'ACTIVE') {
    redirect('/partners/pending');
  }

  const stats = await getPartnerStats(partner.partnerId);

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <h1 className="font-semibold text-neutral-900">{partner.partnerName}</h1>
              <p className="text-sm text-neutral-500">Partner Portal</p>
            </div>
          </div>
          <form action="/api/partners/auth/logout" method="POST">
            <button type="submit" className="text-sm text-neutral-600 hover:text-neutral-900">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-neutral-900">Welcome, {partner.name || partner.partnerName}</h2>
          <p className="text-neutral-600 mt-1">Manage your API keys, view payouts, and integration settings.</p>
        </div>

        {/* Payout Summary */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-primary-100">Total Paid Out</h3>
              <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalPaid)}</p>
            </div>
            {stats.pendingAmount > 0 && (
              <div className="text-right">
                <p className="text-primary-100 text-sm">Pending</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.pendingAmount)}</p>
                <p className="text-primary-200 text-sm">{stats.pendingCount} settlement{stats.pendingCount !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">API Keys</h3>
            <p className="text-3xl font-semibold text-neutral-900 mt-2">{stats.apiKeys}</p>
            <p className="text-sm text-neutral-500 mt-1">{stats.activeApiKeys} active</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Total API Requests</h3>
            <p className="text-3xl font-semibold text-neutral-900 mt-2">{stats.totalRequests.toLocaleString()}</p>
            <p className="text-sm text-neutral-500 mt-1">All time</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Settlements</h3>
            <p className="text-3xl font-semibold text-neutral-900 mt-2">{stats.totalSettlements}</p>
            <p className="text-sm text-neutral-500 mt-1">{stats.pendingCount} pending</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Account Status</h3>
            <p className="text-xl font-semibold text-green-600 mt-2">Active</p>
            <p className="text-sm text-neutral-500 mt-1">{partner.partnerSlug}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/partners/settlements"
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Settlements & Payouts</h3>
                <p className="text-neutral-600 mt-1">View your settlement history and payment details</p>
              </div>
            </div>
          </Link>

          <Link
            href="/partners/api-keys"
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">API Keys</h3>
                <p className="text-neutral-600 mt-1">Generate and manage your API keys for integration</p>
              </div>
            </div>
          </Link>

          <Link
            href="/partners/documentation"
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Documentation</h3>
                <p className="text-neutral-600 mt-1">API documentation and integration guides</p>
              </div>
            </div>
          </Link>

          <Link
            href="/partners/settings"
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Settings</h3>
                <p className="text-neutral-600 mt-1">Manage your account and webhook settings</p>
              </div>
            </div>
          </Link>

          <Link
            href="/partners/usage"
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Usage & Analytics</h3>
                <p className="text-neutral-600 mt-1">View API usage statistics and logs</p>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
