// app/admin/settlements/[id]/page.tsx
// Settlement detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SettlementStatus } from '@prisma/client';
import { SettlementActions } from './SettlementActions';

async function getSettlement(id: string) {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id },
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          paymentMethod: true,
          bankName: true,
          bankSwiftCode: true,
        },
      },
      captures: {
        orderBy: { capturedAt: 'asc' },
      },
    },
  });

  return settlement;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function StatusBadge({ status }: { status: SettlementStatus }) {
  const styles: Record<SettlementStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    PAID: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    DISPUTED: 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const settlement = await getSettlement(id);

  if (!settlement) {
    notFound();
  }

  // Group captures by creator
  const byCreator = new Map<string, { email?: string; amount: number; count: number }>();
  for (const capture of settlement.captures) {
    const existing = byCreator.get(capture.creatorId);
    if (existing) {
      existing.amount += Number(capture.amount);
      existing.count += 1;
    } else {
      byCreator.set(capture.creatorId, {
        email: capture.creatorEmail ?? undefined,
        amount: Number(capture.amount),
        count: 1,
      });
    }
  }

  // Group by project
  const byProject = new Map<string, { name?: string; amount: number; count: number }>();
  for (const capture of settlement.captures) {
    const existing = byProject.get(capture.projectId);
    if (existing) {
      existing.amount += Number(capture.amount);
      existing.count += 1;
    } else {
      byProject.set(capture.projectId, {
        name: capture.projectName ?? undefined,
        amount: Number(capture.amount),
        count: 1,
      });
    }
  }

  return (
    <AdminLayout
      title={`Settlement #${id.slice(0, 8)}...`}
      description={`${settlement.partner.name} - ${formatDateRange(settlement.periodStart, settlement.periodEnd)}`}
      backLink="/admin/settlements"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-neutral-900">Settlement Summary</h2>
              <StatusBadge status={settlement.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-neutral-500">Partner</p>
                <Link href={`/admin/partners/${settlement.partnerId}`} className="text-primary-600 hover:underline font-medium">
                  {settlement.partner.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Contact</p>
                <p className="text-neutral-900">{settlement.partner.contactEmail || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Period</p>
                <p className="text-neutral-900">{formatDateRange(settlement.periodStart, settlement.periodEnd)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Captures</p>
                <p className="text-neutral-900">{settlement.captures.length}</p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex justify-between py-2">
                <span className="text-neutral-600">Gross Amount</span>
                <span className="font-medium">{formatCurrency(Number(settlement.grossAmount))}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-neutral-600">Partner Fee ({(Number(settlement.feePercentage) * 100).toFixed(1)}%)</span>
                <span className="font-medium text-red-600">-{formatCurrency(Number(settlement.partnerFee))}</span>
              </div>
              <div className="border-t border-neutral-200 mt-2 pt-2">
                <div className="flex justify-between py-2">
                  <span className="font-semibold text-neutral-900">Net Amount</span>
                  <span className="font-bold text-green-600 text-lg">{formatCurrency(Number(settlement.netAmount))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Captures by Creator */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="font-semibold text-neutral-900">By Creator</h2>
            </div>
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Creator ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Captures</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {Array.from(byCreator.entries())
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([creatorId, data]) => (
                    <tr key={creatorId}>
                      <td className="px-6 py-4 text-sm font-mono text-neutral-900">{creatorId}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{data.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{data.count}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(data.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Captures by Project */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="font-semibold text-neutral-900">By Project</h2>
            </div>
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Project ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Captures</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {Array.from(byProject.entries())
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([projectId, data]) => (
                    <tr key={projectId}>
                      <td className="px-6 py-4 text-sm font-mono text-neutral-900">{projectId}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{data.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-500">{data.count}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(data.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* All Captures */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="font-semibold text-neutral-900">All Captures ({settlement.captures.length})</h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Capture ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Creator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Captured At</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {settlement.captures.map((capture) => (
                    <tr key={capture.id}>
                      <td className="px-6 py-3 text-xs font-mono text-neutral-500">{capture.id.slice(0, 8)}...</td>
                      <td className="px-6 py-3 text-sm text-neutral-900">{capture.creatorId}</td>
                      <td className="px-6 py-3 text-sm text-neutral-500">{capture.projectName || capture.projectId}</td>
                      <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(capture.capturedAt)}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(Number(capture.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <SettlementActions
            settlementId={settlement.id}
            status={settlement.status}
            netAmount={Number(settlement.netAmount)}
            paymentMethod={settlement.partner.paymentMethod}
            paymentRef={settlement.paymentRef}
          />

          {/* Payment Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Payment Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Method</dt>
                <dd className="font-medium">{settlement.partner.paymentMethod || 'Not configured'}</dd>
              </div>
              {settlement.partner.bankName && (
                <div>
                  <dt className="text-neutral-500">Bank</dt>
                  <dd className="font-medium">{settlement.partner.bankName}</dd>
                </div>
              )}
              {settlement.partner.bankSwiftCode && (
                <div>
                  <dt className="text-neutral-500">SWIFT/BIC</dt>
                  <dd className="font-mono">{settlement.partner.bankSwiftCode}</dd>
                </div>
              )}
              {settlement.paymentRef && (
                <div>
                  <dt className="text-neutral-500">Payment Reference</dt>
                  <dd className="font-mono">{settlement.paymentRef}</dd>
                </div>
              )}
              {settlement.paidAt && (
                <div>
                  <dt className="text-neutral-500">Paid At</dt>
                  <dd>{formatDate(settlement.paidAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Timeline</h3>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-neutral-400"></div>
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-neutral-500">{formatDate(settlement.createdAt)}</p>
                </div>
              </div>
              {settlement.approvedAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                  <div>
                    <p className="font-medium">Approved</p>
                    <p className="text-neutral-500">{formatDate(settlement.approvedAt)}</p>
                    {settlement.approvedBy && <p className="text-neutral-400 text-xs">by {settlement.approvedBy}</p>}
                  </div>
                </div>
              )}
              {settlement.paidAt && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500"></div>
                  <div>
                    <p className="font-medium">Paid</p>
                    <p className="text-neutral-500">{formatDate(settlement.paidAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {settlement.adminNotes && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Notes</h3>
              <pre className="text-sm text-neutral-600 whitespace-pre-wrap font-sans">{settlement.adminNotes}</pre>
            </div>
          )}

          {/* Dispute Reason */}
          {settlement.disputeReason && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
              <h3 className="font-semibold text-orange-900 mb-2">Dispute Reason</h3>
              <p className="text-sm text-orange-800">{settlement.disputeReason}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
