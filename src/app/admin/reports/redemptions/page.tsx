// app/admin/reports/redemptions/page.tsx
// Gift card redemption patterns report

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getRedemptionData() {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get redemption stats
  const [
    totalRedeemed,
    last30DaysRedeemed,
    avgRedemptionTime,
    redemptionsByPartner,
    redemptionsByAmount,
    recentRedemptions,
  ] = await Promise.all([
    prisma.giftCard.count({ where: { status: 'REDEEMED' } }),
    prisma.giftCard.count({ where: { status: 'REDEEMED', redeemedAt: { gte: last30Days } } }),
    prisma.$queryRaw<Array<{ avg_hours: number }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (redeemed_at - created_at)) / 3600) as avg_hours
      FROM gift_cards
      WHERE status = 'REDEEMED' AND redeemed_at IS NOT NULL
    `,
    prisma.giftCard.groupBy({
      by: ['redeemedByPartnerId'],
      where: { status: 'REDEEMED', redeemedByPartnerId: { not: null } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.giftCard.groupBy({
      by: ['amount'],
      where: { status: 'REDEEMED' },
      _count: true,
      orderBy: { amount: 'asc' },
    }),
    prisma.giftCard.findMany({
      where: { status: 'REDEEMED' },
      orderBy: { redeemedAt: 'desc' },
      take: 20,
      include: { redeemedByPartner: { select: { name: true } } },
    }),
  ]);

  // Get partner names
  const partnerIds = redemptionsByPartner.map(r => r.redeemedByPartnerId).filter(Boolean) as string[];
  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true },
  });
  const partnerMap = new Map(partners.map(p => [p.id, p.name]));

  // Calculate redemption rate
  const totalCards = await prisma.giftCard.count({ where: { status: { in: ['ACTIVE', 'REDEEMED'] } } });
  const redemptionRate = totalCards > 0 ? (totalRedeemed / totalCards) * 100 : 0;

  return {
    stats: {
      totalRedeemed,
      last30DaysRedeemed,
      avgRedemptionHours: avgRedemptionTime[0]?.avg_hours || 0,
      redemptionRate,
    },
    byPartner: redemptionsByPartner.map(r => ({
      partnerId: r.redeemedByPartnerId,
      partnerName: r.redeemedByPartnerId ? partnerMap.get(r.redeemedByPartnerId) || 'Unknown' : 'Direct',
      count: r._count,
      totalValue: Number(r._sum.amount) || 0,
    })),
    byAmount: redemptionsByAmount.map(r => ({
      amount: r.amount,
      count: r._count,
    })),
    recent: recentRedemptions.map(r => ({
      id: r.id,
      codeLast4: r.codeLast4,
      amount: r.amount,
      redeemedAt: r.redeemedAt,
      partnerName: r.redeemedByPartner?.name || 'Direct',
    })),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function RedemptionsReportPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const data = await getRedemptionData();

  return (
    <AdminLayout
      title="Redemption Report"
      description="Gift card redemption patterns and analytics"
    >
      <div className="mb-6">
        <Link href="/admin/reports" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Reports
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Redeemed</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.stats.totalRedeemed.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Last 30 Days</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.stats.last30DaysRedeemed.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Redemption Rate</h3>
          <p className="text-2xl font-semibold text-green-600 mt-2">
            {data.stats.redemptionRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Avg Time to Redeem</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">
            {data.stats.avgRedemptionHours.toFixed(1)}h
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* By Partner */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Redemptions by Partner</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.byPartner.length > 0 ? data.byPartner.map((partner) => (
              <div key={partner.partnerId || 'direct'} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{partner.partnerName}</p>
                  <p className="text-sm text-neutral-500">{partner.count} redemptions</p>
                </div>
                <p className="font-semibold text-neutral-900">{formatCurrency(partner.totalValue)}</p>
              </div>
            )) : (
              <div className="p-8 text-center text-neutral-500">No redemption data available</div>
            )}
          </div>
        </div>

        {/* By Amount */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Redemptions by Amount</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.byAmount.length > 0 ? data.byAmount.map((tier) => (
              <div key={tier.amount} className="p-4 flex items-center justify-between">
                <p className="font-medium text-neutral-900">{formatCurrency(Number(tier.amount))} cards</p>
                <p className="font-semibold text-neutral-900">{tier.count} redeemed</p>
              </div>
            )) : (
              <div className="p-8 text-center text-neutral-500">No redemption data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Redemptions */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Recent Redemptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Partner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Redeemed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.recent.map((redemption) => (
                <tr key={redemption.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-mono text-neutral-900">****{redemption.codeLast4}</td>
                  <td className="px-6 py-4 text-sm text-neutral-900">{formatCurrency(Number(redemption.amount))}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{redemption.partnerName}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(redemption.redeemedAt)}</td>
                </tr>
              ))}
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
