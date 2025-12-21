// app/admin/settings/page.tsx
// General settings page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getSystemHealth() {
  const [
    dbConnected,
    giftCardCount,
    userCount,
    partnerCount,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    prisma.giftCard.count(),
    prisma.user.count(),
    prisma.partner.count(),
  ]);

  return {
    dbConnected,
    giftCardCount,
    userCount,
    partnerCount,
  };
}

export default async function GeneralSettingsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const health = await getSystemHealth();

  const settingsSections = [
    {
      title: 'API Keys',
      description: 'Manage Stripe, SendGrid, and internal API keys',
      href: '/admin/settings/api',
      icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    },
    {
      title: 'Payment Settings',
      description: 'Configure payment amounts, limits, and Stripe options',
      href: '/admin/settings/payments',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    },
    {
      title: 'Email Settings',
      description: 'Configure SendGrid and email templates',
      href: '/admin/settings/email',
      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    },
    {
      title: 'Security Settings',
      description: 'Configure rate limiting, session policies, and access controls',
      href: '/admin/settings/security',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
  ];

  return (
    <AdminLayout title="Settings" description="Manage system configuration">
      {/* System Health */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${health.dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-neutral-600">Database</span>
          </div>
          <div>
            <div className="text-2xl font-semibold text-neutral-900">{health.giftCardCount}</div>
            <div className="text-sm text-neutral-600">Gift Cards</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-neutral-900">{health.userCount}</div>
            <div className="text-sm text-neutral-600">Users</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-neutral-900">{health.partnerCount}</div>
            <div className="text-sm text-neutral-600">Partners</div>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {settingsSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-primary-300 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{section.title}</h3>
                <p className="text-neutral-600 mt-1">{section.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Info */}
      <div className="mt-8 bg-neutral-50 rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Environment</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Node Environment</dt>
            <dd className="font-medium text-neutral-900">{process.env.NODE_ENV || 'development'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Base URL</dt>
            <dd className="font-medium text-neutral-900">{process.env.NEXT_PUBLIC_BASE_URL || 'Not set'}</dd>
          </div>
        </dl>
      </div>
    </AdminLayout>
  );
}
