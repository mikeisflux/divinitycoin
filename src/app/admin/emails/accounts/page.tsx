// app/admin/emails/accounts/page.tsx
// SMTP email account/sender configuration

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';

async function getSmtpStatus() {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'],
      },
    },
  });

  const configMap = new Map(configs.map((c: { key: string; value: string }) => [c.key, c.value]));

  return {
    host: configMap.get('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.office365.com',
    port: configMap.get('SMTP_PORT') || process.env.SMTP_PORT || '587',
    user: configMap.get('SMTP_USER') || process.env.SMTP_USER || '',
    hasPassword: !!(configMap.get('SMTP_PASS') || process.env.SMTP_PASS),
    fromEmail: configMap.get('SMTP_FROM_EMAIL') || process.env.SMTP_FROM_EMAIL || '',
    fromName: configMap.get('SMTP_FROM_NAME') || process.env.SMTP_FROM_NAME || 'CreatorCredits',
  };
}

export default async function EmailAccountsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const smtp = await getSmtpStatus();
  const isConfigured = !!(smtp.user && smtp.hasPassword);

  return (
    <AdminLayout
      title="Email Accounts"
      description="SMTP email configuration status"
    >
      <div className="mb-6">
        <Link href="/admin/emails" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Email Dashboard
        </Link>
      </div>

      {/* SMTP Status */}
      <div className={`rounded-xl border p-6 mb-8 ${
        isConfigured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isConfigured ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isConfigured ? (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div>
            <h3 className={`font-semibold ${isConfigured ? 'text-green-900' : 'text-red-900'}`}>
              SMTP {isConfigured ? 'Configured' : 'Not Configured'}
            </h3>
            <p className={`text-sm mt-1 ${isConfigured ? 'text-green-700' : 'text-red-700'}`}>
              {isConfigured
                ? 'Your SMTP server is configured and ready to send emails.'
                : 'Configure your SMTP settings in the Email Settings page to enable email sending.'}
            </p>
          </div>
        </div>
      </div>

      {/* Current Configuration */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Current SMTP Configuration</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">SMTP Server</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono">
                {smtp.host}:{smtp.port}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Username</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                {smtp.user || <span className="text-neutral-400">Not set</span>}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">From Email</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                {smtp.fromEmail || <span className="text-neutral-400">Not set</span>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">From Name</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                {smtp.fromName}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Password Status</label>
            <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
              {smtp.hasPassword ? (
                <span className="text-green-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Password configured
                </span>
              ) : (
                <span className="text-red-600">Not set</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Office 365 Info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-3">GoDaddy Office 365 Configuration</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>For GoDaddy Office 365 email accounts, use these settings:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>SMTP Server: <code className="bg-blue-100 px-1 rounded">smtp.office365.com</code></li>
            <li>Port: <code className="bg-blue-100 px-1 rounded">587</code> (STARTTLS)</li>
            <li>Username: Your full email address</li>
            <li>Password: Your Office 365 password or app password</li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Configuration</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-neutral-600 mb-4">
            Configure your SMTP settings to enable email sending for gift card codes and notifications.
          </p>
          <div className="flex gap-3">
            <Link
              href="/admin/settings/email"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure SMTP Settings
            </Link>
            <Link
              href="/admin/emails/logs"
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Email Logs
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
