// app/admin/reports/partners/page.tsx
// Partner activity and usage report

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getPartnerData() {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const partners = await prisma.partner.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: {
        select: {
          apiKeys: true,
          giftCards: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get redemption stats for each partner (cards sold by partner that were redeemed)
  const partnerStats = await Promise.all(
    partners.map(async (partner) => {
      const [totalRedemptions, last30DaysRedemptions, totalValue] = await Promise.all([
        prisma.giftCard.count({
          where: { partnerId: partner.id, status: 'REDEEMED' },
        }),
        prisma.giftCard.count({
          where: {
            partnerId: partner.id,
            status: 'REDEEMED',
            redeemedAt: { gte: last30Days },
          },
        }),
        prisma.giftCard.aggregate({
          where: { partnerId: partner.id, status: 'REDEEMED' },
          _sum: { amount: true },
        }),
      ]);

      return {
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        status: partner.status,
        createdAt: partner.createdAt,
        apiKeys: partner._count.apiKeys,
        totalRedemptions,
        last30DaysRedemptions,
        totalValue: Number(totalValue._sum.amount) || 0,
      };
    })
  );

  // Get overall partner stats
  const [totalPartners, activePartners, pendingPartners] = await Promise.all([
    prisma.partner.count(),
    prisma.partner.count({ where: { status: 'ACTIVE' } }),
    prisma.partner.count({ where: { status: 'PENDING' } }),
  ]);

  // Total redemption value via partners
  const totalPartnerValue = await prisma.giftCard.aggregate({
    where: { partnerId: { not: null }, status: 'REDEEMED' },
    _sum: { amount: true },
  });

  return {
    partners: partnerStats.sort((a, b) => b.totalValue - a.totalValue),
    summary: {
      totalPartners,
      activePartners,
      pendingPartners,
      totalRedemptionValue: Number(totalPartnerValue._sum.amount) || 0,
    },
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function PartnersReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getPartnerData();

  return (
    <AdminLayout
      title="Partner Report"
      description="Partner activity and usage analytics"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Partners</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.summary.totalPartners}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Active Partners</h3>
          <p className="text-2xl font-semibold text-green-600 mt-2">
            {data.summary.activePartners}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Pending Approval</h3>
          <p className="text-2xl font-semibold text-amber-600 mt-2">
            {data.summary.pendingPartners}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Partner Volume</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {formatCurrency(data.summary.totalRedemptionValue)}
          </p>
        </div>
      </div>

      {/* Partner Performance Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Partner Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Partner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">API Keys</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Total Redemptions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Last 30 Days</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.partners.length > 0 ? data.partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-neutral-900">{partner.name}</p>
                      <p className="text-sm text-neutral-500">{partner.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      partner.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      partner.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-neutral-100 text-neutral-700'
                    }`}>
                      {partner.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{partner.apiKeys}</td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-900">{partner.totalRedemptions}</td>
                  <td className="px-6 py-4 text-sm text-right text-neutral-600">{partner.last30DaysRedemptions}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-neutral-900">
                    {formatCurrency(partner.totalValue)}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(partner.createdAt)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    No active partners found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
