// app/admin/transactions/page.tsx
// Transaction management page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { SyncTransactionsButton } from '@/components/admin/SyncTransactionsButton';
import { RemindUsersButton } from '@/components/admin/RemindUsersButton';
import { LinkPurchasesButton } from '@/components/admin/LinkPurchasesButton';

async function getTransactions(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [transactions, total, partnerPayments, ppTotal] = await Promise.all([
    prisma.transaction.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        giftCard: {
          select: { codeLast4: true, amount: true },
        },
      },
    }),
    prisma.transaction.count(),
    prisma.pendingPartnerPayment.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pendingPartnerPayment.count(),
  ]);

  return { transactions, total, partnerPayments, ppTotal, pages: Math.ceil((total + ppTotal) / limit) };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PURCHASE: 'bg-blue-100 text-blue-800',
    REFUND: 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || 'bg-neutral-100 text-neutral-800'}`}>
      {type}
    </span>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function TransactionsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const { transactions, total, partnerPayments, ppTotal } = await getTransactions();

  // Count pending transactions
  const pendingCount = transactions.filter(t => t.status === 'PENDING').length;
  const pendingPartnerCount = partnerPayments.filter(p => p.status === 'PENDING').length;

  return (
    <AdminLayout
      title="Transactions"
      description={`${total} legacy + ${ppTotal} partner payments`}
    >
      {/* Action Buttons */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-neutral-600 flex gap-2">
          {pendingCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
              {pendingCount} pending legacy
            </span>
          )}
          {pendingPartnerCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
              {pendingPartnerCount} pending partner
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <LinkPurchasesButton />
          <RemindUsersButton />
          <SyncTransactionsButton />
        </div>
      </div>

      {/* Partner Payments Section */}
      {partnerPayments.length > 0 && (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-neutral-900 mb-3">Partner Payments ({ppTotal})</h3>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Payment
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Pledge / Project
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Hold
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {partnerPayments.map((pp) => (
                <tr key={pp.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-neutral-900 font-mono">
                      {pp.paymentIntentId.slice(0, 15)}...
                    </div>
                    <div className="text-xs text-neutral-500">
                      {pp.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-neutral-900 font-mono">{pp.pledgeId.slice(0, 12)}...</div>
                    <div className="text-xs text-neutral-500">Project: {pp.projectId.slice(0, 12)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-green-600">
                      +{formatCurrency(pp.amount / 100)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={pp.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {pp.holdId ? (
                      <span className="font-mono text-xs text-green-600">{pp.holdId.slice(0, 8)}...</span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(pp.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Legacy Transactions Section */}
      <h3 className="text-lg font-semibold text-neutral-900 mb-3">Legacy Transactions ({total})</h3>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Transaction
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Gift Card
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                  No legacy transactions.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-neutral-900 font-mono">
                      {tx.id.slice(0, 8)}...
                    </div>
                    {tx.stripePaymentIntentId && (
                      <div className="text-xs text-neutral-500">
                        {tx.stripePaymentIntentId.slice(0, 15)}...
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${tx.type === 'REFUND' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'REFUND' ? '-' : '+'}{formatCurrency(Number(tx.amount))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {tx.giftCard ? `****${tx.giftCard.codeLast4}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/transactions/${tx.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
