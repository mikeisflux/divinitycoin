// app/partners/settings/page.tsx
// Partner settings page

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PartnerSettings {
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
  notificationEmail: string;
  ipWhitelist: string[];
  rateLimitTier: string;
}

export default function PartnerSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PartnerSettings>({
    webhookUrl: '',
    webhookSecret: '',
    webhookEvents: [],
    notificationEmail: '',
    ipWhitelist: [],
    rateLimitTier: 'standard',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const webhookEventOptions = [
    { id: 'card.created', label: 'Card Created', description: 'When a new gift card is issued' },
    { id: 'card.redeemed', label: 'Card Redeemed', description: 'When a gift card is fully redeemed' },
    { id: 'card.partially_redeemed', label: 'Card Partially Redeemed', description: 'When a gift card is partially used' },
    { id: 'card.expired', label: 'Card Expired', description: 'When a gift card expires' },
    { id: 'card.refunded', label: 'Card Refunded', description: 'When a gift card is refunded' },
    { id: 'transaction.completed', label: 'Transaction Completed', description: 'When a transaction completes' },
    { id: 'transaction.failed', label: 'Transaction Failed', description: 'When a transaction fails' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/partners/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else if (response.status === 401) {
        router.push('/partners/login');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/partners/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('Settings saved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save settings');
      }
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const regenerateWebhookSecret = async () => {
    if (!confirm('Are you sure? This will invalidate your current webhook secret.')) {
      return;
    }

    try {
      const response = await fetch('/api/partners/settings/webhook-secret', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, webhookSecret: data.secret }));
        setShowWebhookSecret(true);
        alert('New webhook secret generated. Make sure to update your server.');
      } else {
        alert('Failed to regenerate secret');
      }
    } catch (error) {
      alert('Failed to regenerate webhook secret');
    }
  };

  const changePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/partners/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        alert('Password changed successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to change password');
      }
    } catch (error) {
      alert('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleWebhookEvent = (eventId: string) => {
    setSettings(prev => ({
      ...prev,
      webhookEvents: prev.webhookEvents.includes(eventId)
        ? prev.webhookEvents.filter(e => e !== eventId)
        : [...prev.webhookEvents, eventId],
    }));
  };

  const addIpToWhitelist = () => {
    const ip = ipInput.trim();
    if (!ip) return;

    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ip)) {
      alert('Please enter a valid IP address or CIDR range');
      return;
    }

    if (!settings.ipWhitelist.includes(ip)) {
      setSettings(prev => ({
        ...prev,
        ipWhitelist: [...prev.ipWhitelist, ip],
      }));
    }
    setIpInput('');
  };

  const removeIpFromWhitelist = (ip: string) => {
    setSettings(prev => ({
      ...prev,
      ipWhitelist: prev.ipWhitelist.filter(i => i !== ip),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/partners/dashboard" className="text-neutral-500 hover:text-neutral-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
              <p className="text-sm text-neutral-500">Configure webhooks, security, and account settings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Webhook Configuration */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Webhook Configuration</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder="https://your-server.com/webhook"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <p className="text-xs text-neutral-500 mt-1">We'll POST events to this URL</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Webhook Secret
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showWebhookSecret ? 'text' : 'password'}
                    value={settings.webhookSecret || 'Not generated'}
                    readOnly
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-neutral-50 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showWebhookSecret ? (
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
                <button
                  onClick={regenerateWebhookSecret}
                  className="px-4 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50"
                >
                  Regenerate
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Use this to verify webhook signatures</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Subscribed Events
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {webhookEventOptions.map((event) => (
                  <label
                    key={event.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      settings.webhookEvents.includes(event.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.webhookEvents.includes(event.id)}
                      onChange={() => toggleWebhookEvent(event.id)}
                      className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{event.label}</p>
                      <p className="text-xs text-neutral-500">{event.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Security Settings</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                IP Whitelist (Optional)
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="192.168.1.1 or 10.0.0.0/8"
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addIpToWhitelist()}
                />
                <button
                  onClick={addIpToWhitelist}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
                >
                  Add IP
                </button>
              </div>
              {settings.ipWhitelist.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.ipWhitelist.map((ip) => (
                    <span
                      key={ip}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full text-sm"
                    >
                      <code className="text-neutral-700">{ip}</code>
                      <button
                        onClick={() => removeIpFromWhitelist(ip)}
                        className="text-neutral-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No IP restrictions. All IPs are allowed.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Rate Limit Tier
              </label>
              <select
                value={settings.rateLimitTier}
                onChange={(e) => setSettings(prev => ({ ...prev, rateLimitTier: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="standard">Standard (100 req/min)</option>
                <option value="professional">Professional (500 req/min)</option>
                <option value="enterprise">Enterprise (2000 req/min)</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">Contact support to upgrade your rate limit tier</p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Notifications</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Notification Email
            </label>
            <input
              type="email"
              value={settings.notificationEmail}
              onChange={(e) => setSettings(prev => ({ ...prev, notificationEmail: e.target.value }))}
              placeholder="notifications@your-company.com"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-neutral-500 mt-1">We'll send important notifications to this email</p>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Change Password</h2>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <button
              onClick={changePassword}
              disabled={changingPassword}
              className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </main>
    </div>
  );
}
