// app/admin/settlements/[id]/page.tsx
// Admin settlement detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { getSettlementDetail } from '@/lib/settlements';
import { SettlementStatus } from '@prisma/client';
import Link from 'next/link';
import { SettlementActions } from './SettlementActions';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getStatusBadgeClass(status: SettlementStatus): string {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED': return 'bg-blue-100 text-blue-800';
    case 'PROCESSING': return 'bg-purple-100 text-purple-800';
    case 'FAILED': return 'bg-red-100 text-red-800';
    case 'DISPUTED': return 'bg-orange-100 text-orange-800';
    default: return 'bg-neutral-100 text-neutral-800';
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettlementDetailPage({ params }: PageProps) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const settlement = await getSettlementDetail(id);

  if (!settlement) {
    notFound();
  }

  return (
    <AdminLayout
      title={`Settlement - ${settlement.partnerName}`}
      description={`${settlement.periodStart.toLocaleDateString()} to ${settlement.periodEnd.toLocaleDateString()}`}
    >
      <div className="mb-6">
        <Link href="/admin/settlements" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Settlements
        </Link>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{settlement.partnerName}</h2>
            <p className="text-neutral-500">
              Period: {settlement.periodStart.toLocaleDateString()} - {settlement.periodEnd.toLocaleDateString()}
            </p>
          </div>
          <span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${getStatusBadgeClass(settlement.status)}`}>
            {settlement.status}
          </span>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-neutral-500">Gross Amount</p>
            <p className="text-2xl font-semibold text-neutral-900">{formatCurrency(settlement.grossAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Platform Fee ({(settlement.feePercentage * 100).toFixed(1)}%)</p>
            <p className="text-2xl font-semibold text-red-600">-{formatCurrency(settlement.partnerFee)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Net Payout</p>
            <p className="text-2xl font-semibold text-green-600">{formatCurrency(settlement.netAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Captures</p>
            <p className="text-2xl font-semibold text-neutral-900">{settlement.captureCount}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <SettlementActions settlementId={settlement.id} status={settlement.status} />
        </div>
      </div>

      {/* Payment Info */}
      {(settlement.paymentMethod || settlement.paymentRef || settlement.paidAt) && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Payment Details</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {settlement.paymentMethod && (
              <div>
                <p className="text-sm text-neutral-500">Payment Method</p>
                <p className="font-medium text-neutral-900">{settlement.paymentMethod}</p>
              </div>
            )}
            {settlement.paymentRef && (
              <div>
                <p className="text-sm text-neutral-500">Reference</p>
                <p className="font-medium text-neutral-900">{settlement.paymentRef}</p>
              </div>
            )}
            {settlement.paidAt && (
              <div>
                <p className="text-sm text-neutral-500">Paid At</p>
                <p className="font-medium text-neutral-900">{settlement.paidAt.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {(settlement.adminNotes || settlement.disputeReason) && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Notes</h3>
          {settlement.adminNotes && (
            <div className="mb-4">
              <p className="text-sm text-neutral-500 mb-1">Admin Notes</p>
              <p className="text-neutral-700">{settlement.adminNotes}</p>
            </div>
          )}
          {settlement.disputeReason && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-600 font-medium mb-1">Dispute Reason</p>
              <p className="text-orange-800">{settlement.disputeReason}</p>
            </div>
          )}
        </div>
      )}

      {/* By Creator */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">By Creator</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="py-2 text-left text-sm font-medium text-neutral-500">Creator ID</th>
              <th className="py-2 text-left text-sm font-medium text-neutral-500">Email</th>
              <th className="py-2 text-right text-sm font-medium text-neutral-500">Captures</th>
              <th className="py-2 text-right text-sm font-medium text-neutral-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {settlement.byCreator.map(c => (
              <tr key={c.creatorId}>
                <td className="py-2 text-sm font-mono text-neutral-900">{c.creatorId}</td>
                <td className="py-2 text-sm text-neutral-600">{c.creatorEmail || '-'}</td>
                <td className="py-2 text-sm text-right text-neutral-600">{c.count}</td>
                <td className="py-2 text-sm text-right font-medium text-neutral-900">{formatCurrency(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By Project */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">By Project</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="py-2 text-left text-sm font-medium text-neutral-500">Project ID</th>
              <th className="py-2 text-left text-sm font-medium text-neutral-500">Name</th>
              <th className="py-2 text-right text-sm font-medium text-neutral-500">Captures</th>
              <th className="py-2 text-right text-sm font-medium text-neutral-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {settlement.byProject.map(p => (
              <tr key={p.projectId}>
                <td className="py-2 text-sm font-mono text-neutral-900">{p.projectId}</td>
                <td className="py-2 text-sm text-neutral-600">{p.projectName || '-'}</td>
                <td className="py-2 text-sm text-right text-neutral-600">{p.count}</td>
                <td className="py-2 text-sm text-right font-medium text-neutral-900">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All Captures */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900">All Captures ({settlement.captureCount})</h3>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Captured At</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Creator</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Project</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {settlement.captures.slice(0, 50).map(c => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm text-neutral-600">{c.capturedAt.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-mono text-neutral-900">{c.creatorId}</span>
                  {c.creatorEmail && <span className="text-neutral-500 ml-2">({c.creatorEmail})</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {c.projectName || <span className="font-mono text-neutral-600">{c.projectId}</span>}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-neutral-900">{formatCurrency(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {settlement.captureCount > 50 && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-center text-sm text-neutral-500">
            Showing first 50 of {settlement.captureCount} captures
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
