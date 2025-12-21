// app/admin/settings/email/page.tsx
// SendGrid Email settings page

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface EmailSettings {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  testEmailRecipient: string;
  isConfigured: boolean;
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>({
    apiKey: '',
    fromEmail: '',
    fromName: 'DivinityCoin',
    replyTo: '',
    testEmailRecipient: '',
    isConfigured: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/email');
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'SendGrid settings saved successfully' });
        fetchSettings();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyConnection = async () => {
    setVerifying(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings/email/verify', {
        method: 'POST',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'SendGrid configuration looks good!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Configuration verification failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify configuration' });
    } finally {
      setVerifying(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.testEmailRecipient) {
      setMessage({ type: 'error', text: 'Please enter a test email recipient' });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: settings.testEmailRecipient }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to send test email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send test email' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Email Settings" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Email Settings"
      description="Configure SendGrid for transactional emails"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      {/* Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border ${settings.isConfigured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          {settings.isConfigured ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`font-medium ${settings.isConfigured ? 'text-green-800' : 'text-red-800'}`}>
            {settings.isConfigured ? 'SendGrid configured' : 'SendGrid not configured'}
          </span>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* SendGrid API Configuration */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">SendGrid API Configuration</h2>
        <p className="text-sm text-neutral-600 mb-6">
          Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">SendGrid Dashboard</a>
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              SendGrid API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                onFocus={(e) => {
                  if (e.target.value === '••••••••') {
                    setSettings(prev => ({ ...prev, apiKey: '' }));
                  }
                }}
                className="w-full px-4 py-2 pr-12 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
                placeholder="SG.xxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              {settings.apiKey === '••••••••' ? 'API key saved. Click to enter a new key.' : 'Starts with "SG." - Full Access or Mail Send permission required'}
            </p>
          </div>
        </div>
      </div>

      {/* Sender Information */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Sender Information</h2>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                From Email Address
              </label>
              <input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="noreply@divinitycoin.com"
              />
              <p className="text-sm text-neutral-500 mt-1">Must be verified in SendGrid</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                From Name
              </label>
              <input
                type="text"
                value={settings.fromName}
                onChange={(e) => setSettings(prev => ({ ...prev, fromName: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="DivinityCoin"
              />
              <p className="text-sm text-neutral-500 mt-1">Display name for sent emails</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Reply-To Email (Optional)
            </label>
            <input
              type="email"
              value={settings.replyTo}
              onChange={(e) => setSettings(prev => ({ ...prev, replyTo: e.target.value }))}
              className="w-full md:w-1/2 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="support@divinitycoin.com"
            />
            <p className="text-sm text-neutral-500 mt-1">Where replies will be sent (defaults to From address)</p>
          </div>
        </div>
      </div>

      {/* Connection Test */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Test Configuration</h2>

        <div className="space-y-6">
          <div>
            <Button variant="outline" onClick={handleVerifyConnection} disabled={verifying}>
              {verifying ? 'Verifying...' : 'Verify Configuration'}
            </Button>
            <p className="text-sm text-neutral-500 mt-2">
              Check that your API key format is valid
            </p>
          </div>

          <hr className="border-neutral-200" />

          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Test Email Recipient
              </label>
              <input
                type="email"
                value={settings.testEmailRecipient}
                onChange={(e) => setSettings(prev => ({ ...prev, testEmailRecipient: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="your@email.com"
              />
            </div>
            <Button variant="outline" onClick={handleTestEmail} disabled={testing}>
              {testing ? 'Sending...' : 'Send Test Email'}
            </Button>
          </div>
          <p className="text-sm text-neutral-500">
            Send a test email to verify your complete configuration is working
          </p>
        </div>
      </div>

      {/* Webhook Info */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Webhook Configuration (Optional)</h2>
        <p className="text-sm text-neutral-600 mb-4">
          To track email delivery status, bounces, and opens, add this webhook URL in your SendGrid Event Webhook settings:
        </p>
        <div className="bg-neutral-100 rounded-lg p-4 font-mono text-sm break-all">
          https://divinitycoin.com/api/webhooks/sendgrid
        </div>
        <p className="text-sm text-neutral-500 mt-2">
          <a href="https://app.sendgrid.com/settings/mail_settings" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
            Configure in SendGrid → Settings → Mail Settings → Event Webhook
          </a>
        </p>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h3 className="font-medium text-blue-900 mb-3">SendGrid Setup Guide</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Create a free account at <a href="https://signup.sendgrid.com/" target="_blank" rel="noopener noreferrer" className="underline">sendgrid.com</a> (100 emails/day free)</li>
          <li>Go to Settings → API Keys → Create API Key</li>
          <li>Select "Full Access" or "Restricted Access" with Mail Send permission</li>
          <li>Copy the API key (starts with "SG.")</li>
          <li>Verify your sender email in Settings → Sender Authentication</li>
          <li>Paste API key above and save</li>
        </ol>
      </div>
    </AdminLayout>
  );
}
