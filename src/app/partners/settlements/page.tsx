// app/partners/settlements/page.tsx
// Partner settlements and payout history

import { getPartnerFromRequest } from '@/lib/partner/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED':
      return 'bg-blue-100 text-blue-800';
    case 'PROCESSING':
      return 'bg-purple-100 text-purple-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    case 'DISPUTED':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-neutral-100 text-neutral-800';
  }
}

export default async function PartnerSettlementsPage() {
  const partner = await getPartnerFromRequest();

  if (!partner) {
    redirect('/partners/login');
  }

  if (partner.partnerStatus !== 'ACTIVE') {
    redirect('/partners/pending');
  }

  const settlements = await prisma.partnerSettlement.findMany({
    where: { partnerId: partner.partnerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const stats = await prisma.partnerSettlement.aggregate({
    where: { partnerId: partner.partnerId, status: 'PAID' },
    _sum: { netAmount: true },
    _count: true,
  });

  const totalPaid = Number(stats._sum.netAmount || 0);
  const paidCount = stats._count;

  const pendingSettlements = settlements.filter(
    s => s.status === 'PENDING' || s.status === 'APPROVED' || s.status === 'PROCESSING'
  );
  const pendingAmount = pendingSettlements.reduce((sum, s) => sum + Number(s.netAmount), 0);

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/partners/dashboard" className="text-neutral-400 hover:text-neutral-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-semibold text-neutral-900">Settlements & Payouts</h1>
              <p className="text-sm text-neutral-500">{partner.partnerName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Total Paid</h3>
            <p className="text-3xl font-semibold text-green-600 mt-2">{formatCurrency(totalPaid)}</p>
            <p className="text-sm text-neutral-500 mt-1">{paidCount} settlement{paidCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Pending</h3>
            <p className="text-3xl font-semibold text-yellow-600 mt-2">{formatCurrency(pendingAmount)}</p>
            <p className="text-sm text-neutral-500 mt-1">{pendingSettlements.length} settlement{pendingSettlements.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-medium text-neutral-600">Total Settlements</h3>
            <p className="text-3xl font-semibold text-neutral-900 mt-2">{settlements.length}</p>
            <p className="text-sm text-neutral-500 mt-1">All time</p>
          </div>
        </div>

        {/* Settlements List */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Settlement History</h2>
          </div>

          {settlements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No settlements yet</h3>
              <p className="text-neutral-600">
                Settlements are generated automatically based on your credit captures.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Gross</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Net</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Paid On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <span className="text-sm text-neutral-900">
                          {formatDateRange(settlement.periodStart, settlement.periodEnd)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-neutral-900">
                          {formatCurrency(Number(settlement.grossAmount))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-red-600">
                          -{formatCurrency(Number(settlement.partnerFee))}
                        </span>
                        <span className="text-xs text-neutral-500 ml-1">
                          ({(Number(settlement.feePercentage) * 100).toFixed(0)}%)
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-neutral-900">
                          {formatCurrency(Number(settlement.netAmount))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(settlement.status)}`}>
                          {settlement.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-neutral-600">
                          {settlement.paidAt ? formatDate(settlement.paidAt) : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">About Settlements</h3>
              <p className="text-sm text-blue-800 mt-1">
                Settlements are generated automatically based on your configured frequency.
                Once a settlement is approved, payment is typically processed within 1-3 business days.
              </p>
              <p className="text-sm text-blue-800 mt-2">
                Need to update your payment information?{' '}
                <Link href="/partners/settings" className="font-medium underline">
                  Go to Settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
