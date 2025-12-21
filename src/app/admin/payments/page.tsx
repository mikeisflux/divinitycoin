// app/admin/payments/page.tsx
// Payment history page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getPaymentData(page: number = 1) {
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const [transactions, total, stats] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        giftCard: {
          select: { codeLast4: true },
        },
      },
    }),
    prisma.transaction.count(),
    prisma.transaction.groupBy({
      by: ['status'],
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  const statusStats = stats.reduce(
    (acc, s) => {
      acc[s.status] = { count: s._count, amount: Number(s._sum.amount) || 0 };
      return acc;
    },
    {} as Record<string, { count: number; amount: number }>
  );

  return {
    transactions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: statusStats,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
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
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      type === 'PURCHASE' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
    }`}>
      {type}
    </span>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const data = await getPaymentData(page);

  return (
    <AdminLayout
      title="Payments"
      description="Payment history and Stripe transactions"
      actions={
        <a
          href="https://dashboard.stripe.com/payments"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#635bff] text-white rounded-lg text-sm font-medium hover:bg-[#5851db] transition"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
          </svg>
          Stripe Dashboard
        </a>
      }
    >
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-sm font-medium text-neutral-600">Total Transactions</h3>
          <p className="text-2xl font-semibold text-neutral-900 mt-2">{data.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h3 className="text-sm font-medium text-green-800">Completed</h3>
          <p className="text-2xl font-semibold text-green-900 mt-2">
            {formatCurrency(data.stats.COMPLETED?.amount || 0)}
          </p>
          <p className="text-sm text-green-700 mt-1">{data.stats.COMPLETED?.count || 0} transactions</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
          <h3 className="text-sm font-medium text-yellow-800">Pending</h3>
          <p className="text-2xl font-semibold text-yellow-900 mt-2">
            {formatCurrency(data.stats.PENDING?.amount || 0)}
          </p>
          <p className="text-sm text-yellow-700 mt-1">{data.stats.PENDING?.count || 0} transactions</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
          <h3 className="text-sm font-medium text-purple-800">Refunded</h3>
          <p className="text-2xl font-semibold text-purple-900 mt-2">
            {formatCurrency(data.stats.REFUNDED?.amount || 0)}
          </p>
          <p className="text-sm text-purple-700 mt-1">{data.stats.REFUNDED?.count || 0} transactions</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Card</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Stripe ID</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {data.transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              data.transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {new Date(txn.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TypeBadge type={txn.type} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {txn.guestEmail || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-600">
                    {txn.giftCard?.codeLast4 ? `****${txn.giftCard.codeLast4}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-neutral-900">
                    {formatCurrency(Number(txn.amount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={txn.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-500">
                    {txn.stripePaymentIntentId?.slice(0, 20) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/transactions/${txn.id}`} className="text-primary-600 hover:text-primary-900">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Link
                href={`/admin/payments?page=${data.page - 1}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Previous
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={`/admin/payments?page=${data.page + 1}`}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
