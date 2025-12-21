// app/admin/partners/[id]/page.tsx
// Partner detail page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getPartner(id: string) {
  return prisma.partner.findUnique({
    where: { id },
    include: {
      apiKeys: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    DEACTIVATED: 'bg-neutral-100 text-neutral-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const partner = await getPartner(params.id);

  if (!partner) {
    notFound();
  }

  return (
    <AdminLayout
      title={partner.name}
      description={`Partner details for ${partner.slug}`}
      actions={
        <div className="flex gap-3">
          <Link
            href={`/admin/partners/${partner.id}/edit`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            Edit Partner
          </Link>
        </div>
      }
    >
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Partner Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Partner Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Name</dt>
                <dd className="text-neutral-900 font-medium">{partner.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Slug</dt>
                <dd className="text-neutral-900 font-mono">{partner.slug}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Status</dt>
                <dd><StatusBadge status={partner.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Created</dt>
                <dd className="text-neutral-900">{new Date(partner.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Contact Name</dt>
                <dd className="text-neutral-900">{partner.contactName || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Contact Email</dt>
                <dd className="text-neutral-900">{partner.contactEmail || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">VPN IP</dt>
                <dd className="text-neutral-900 font-mono">{partner.vpnIp || 'Not configured'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Webhook URL</dt>
                <dd className="text-neutral-900 text-sm break-all">{partner.webhookUrl || 'Not configured'}</dd>
              </div>
            </dl>
          </div>

          {/* API Keys */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">API Keys</h2>
              <Link
                href={`/admin/partners/${partner.id}/api-keys/new`}
                className="text-sm text-primary-600 hover:underline"
              >
                Generate New Key
              </Link>
            </div>

            {partner.apiKeys.length === 0 ? (
              <p className="text-neutral-500 text-sm">No API keys generated yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Name</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Key Prefix</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Last Used</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {partner.apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="py-3 text-sm text-neutral-900">{key.name}</td>
                      <td className="py-3 text-sm font-mono text-neutral-600">{key.keyPrefix}...</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-neutral-500">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 text-sm text-neutral-600">{key.requestCount.toString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                Test Webhook
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition">
                View API Logs
              </button>
              {partner.status === 'PENDING' && (
                <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition">
                  Activate Partner
                </button>
              )}
              {partner.status === 'ACTIVE' && (
                <button className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition">
                  Suspend Partner
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
