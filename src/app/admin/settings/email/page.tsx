// app/admin/settings/email/page.tsx
// Email settings page

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface EmailSettings {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  testEmailRecipient: string;
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>({
    fromEmail: '',
    fromName: 'DivinityCoin',
    replyTo: '',
    testEmailRecipient: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/email');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
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
        setMessage({ type: 'success', text: 'Email settings saved successfully' });
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
        setMessage({ type: 'success', text: 'Test email sent successfully' });
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
      description="Configure email delivery settings"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

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
              <p className="text-sm text-neutral-500 mt-1">Must be a verified sender in SendGrid</p>
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

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Test Email</h2>

        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Recipient Email
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
        <p className="text-sm text-neutral-500 mt-2">
          Send a test email to verify your configuration is working
        </p>
      </div>
    </AdminLayout>
  );
}
