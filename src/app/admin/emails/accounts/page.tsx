// app/admin/emails/accounts/page.tsx
// Email account/sender configuration

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function EmailAccountsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  // Get SendGrid configuration from environment
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'CreatorCredits';

  const isConfigured = !!sendgridApiKey;

  return (
    <AdminLayout
      title="Email Accounts"
      description="Configure email sending accounts"
    >
      <div className="mb-6">
        <Link href="/admin/emails" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Email Dashboard
        </Link>
      </div>

      {/* SendGrid Status */}
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
              SendGrid {isConfigured ? 'Connected' : 'Not Configured'}
            </h3>
            <p className={`text-sm mt-1 ${isConfigured ? 'text-green-700' : 'text-red-700'}`}>
              {isConfigured
                ? 'Your SendGrid account is connected and ready to send emails.'
                : 'Set SENDGRID_API_KEY in your environment variables to enable email sending.'}
            </p>
          </div>
        </div>
      </div>

      {/* Current Configuration */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Current Configuration</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">From Email</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                {fromEmail}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Set via SENDGRID_FROM_EMAIL environment variable</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">From Name</label>
              <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                {fromName}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Set via SENDGRID_FROM_NAME environment variable</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">API Key Status</label>
            <div className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
              {isConfigured ? (
                <span className="text-green-600 font-mono">SG.****...{sendgridApiKey?.slice(-8)}</span>
              ) : (
                <span className="text-red-600">Not set</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Webhook Configuration</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-600">
            Configure SendGrid to send event webhooks to track email delivery, opens, and clicks.
          </p>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com'}/webhook/sendgrid`}
                className="flex-1 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono text-sm"
              />
              <button
                type="button"
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
                onClick={() => {}}
              >
                Copy
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Setup Instructions</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Go to SendGrid Dashboard → Settings → Mail Settings → Event Webhook</li>
              <li>Enable the Event Webhook</li>
              <li>Enter the webhook URL above</li>
              <li>Select events: Delivered, Opened, Clicked, Bounced, Dropped, Spam Reports</li>
              <li>Save the configuration</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Send Test Email</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-neutral-600 mb-4">
            Send a test email to verify your configuration is working correctly.
          </p>
          <Link
            href="/admin/settings/email"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            Go to Email Settings
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
