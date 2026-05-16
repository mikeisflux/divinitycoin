// app/admin/checkout/[id]/page.tsx
// Detail view for a single hosted checkout session. Server-rendered;
// reads the session + partner + linked PendingPartnerPayment directly
// and renders all fields read-only.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  COMPLETE: 'bg-green-100 text-green-800',
  FAILED:   'bg-red-100 text-red-800',
  EXPIRED:  'bg-neutral-100 text-neutral-700',
  CANCELED: 'bg-neutral-100 text-neutral-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {status}
    </span>
  );
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="border-b border-neutral-100 py-3 grid grid-cols-3 gap-4">
      <dt className="text-sm font-medium text-neutral-500">{label}</dt>
      <dd className={`col-span-2 text-sm text-neutral-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value ?? <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}

export default async function CheckoutSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = await getAdminFromRequest();
  if (!admin) redirect('/admin/login');

  const session = await prisma.checkoutSession.findUnique({
    where: { id: params.id },
    include: {
      partner: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!session) notFound();

  // For PAYMENT mode, look up the linked PendingPartnerPayment so we
  // can show downstream state (gift card, hold, refund, etc.).
  const linkedPayment = session.paymentIntentId
    ? await prisma.pendingPartnerPayment.findUnique({
        where: { paymentIntentId: session.paymentIntentId },
      })
    : null;

  return (
    <AdminLayout
      title="Checkout Session"
      description={session.sessionToken}
      actions={
        <Link
          href="/admin/checkout"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Back to sessions
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Header summary */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-neutral-500">Status</p>
              <div className="mt-1"><StatusBadge status={session.status} /></div>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Mode</p>
              <p className="mt-1 font-mono text-sm">{session.mode.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Amount</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">
                {formatCurrency(session.amount, session.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Partner</p>
              <p className="mt-1 text-sm text-neutral-900">
                {session.partner ? (
                  <Link
                    href={`/admin/partners/${session.partner.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {session.partner.name}
                  </Link>
                ) : (
                  session.partnerName ?? session.partnerId
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Session details */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Session</h2>
          <dl>
            <Field label="Session ID" value={session.sessionToken} mono />
            <Field label="Internal ID" value={session.id} mono />
            <Field label="Platform User ID" value={session.platformUserId} mono />
            <Field label="Email" value={session.email} />
            <Field label="Pledge ID" value={session.pledgeId} mono />
            <Field label="Project ID" value={session.projectId} mono />
            <Field label="Description" value={session.description} />
            <Field label="Return URL" value={session.returnUrl} mono />
            <Field label="Cancel URL" value={session.cancelUrl} mono />
            <Field label="Partner logo URL" value={session.partnerLogoUrl} mono />
          </dl>
        </div>

        {/* Underlying intent */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Processor intent</h2>
          <dl>
            <Field label="PaymentIntent ID" value={session.paymentIntentId} mono />
            <Field label="SetupIntent ID" value={session.setupIntentId} mono />
            <Field label="PaymentMethod ID" value={session.paymentMethodId} mono />
            {linkedPayment && (
              <>
                <Field
                  label="Linked PendingPartnerPayment"
                  value={
                    <Link
                      href={`/admin/transactions?search=${encodeURIComponent(session.paymentIntentId ?? '')}`}
                      className="text-primary-600 hover:underline font-mono text-xs"
                    >
                      {linkedPayment.id}
                    </Link>
                  }
                />
                <Field label="Pending payment status" value={linkedPayment.status} />
                <Field label="Gift card ID" value={linkedPayment.giftCardId} mono />
                <Field label="Hold ID" value={linkedPayment.holdId} mono />
                <Field label="Refund ID" value={linkedPayment.refundId} mono />
              </>
            )}
          </dl>
        </div>

        {/* Timing */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Timing</h2>
          <dl>
            <Field label="Created" value={formatDateTime(session.createdAt)} />
            <Field label="Updated" value={formatDateTime(session.updatedAt)} />
            <Field label="Expires" value={formatDateTime(session.expiresAt)} />
            <Field label="Completed" value={formatDateTime(session.completedAt)} />
            <Field label="Webhook fired" value={formatDateTime(session.webhookFiredAt)} />
          </dl>
        </div>
      </div>
    </AdminLayout>
  );
}
