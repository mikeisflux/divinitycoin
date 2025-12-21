// app/admin/settings/settlements/page.tsx
// Settlement system configuration

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface SettlementSettings {
  defaultPartnerFee: number;
  defaultMinimumSettlement: number;
  autoApproveEnabled: boolean;
  autoApproveThreshold: number;
  settlementNotificationEmail: string;
  webhookRetryAttempts: number;
  webhookTimeoutMs: number;
}

export default function SettlementSettingsPage() {
  const [settings, setSettings] = useState<SettlementSettings>({
    defaultPartnerFee: 6,
    defaultMinimumSettlement: 100,
    autoApproveEnabled: false,
    autoApproveThreshold: 500,
    settlementNotificationEmail: '',
    webhookRetryAttempts: 3,
    webhookTimeoutMs: 10000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/settlements');
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
      const response = await fetch('/api/admin/settings/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settlement settings saved successfully' });
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

  if (loading) {
    return (
      <AdminLayout title="Settlement Settings" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Settlement Settings"
      description="Configure partner settlement system"
    >
      {/* Fee Configuration */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-900">Fee Configuration</h2>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Default Partner Fee (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.defaultPartnerFee}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultPartnerFee: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Platform fee deducted from partner settlements (default: 6%)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Minimum Settlement Amount ($)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.defaultMinimumSettlement}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultMinimumSettlement: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Minimum amount required to trigger a settlement
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Approval Settings */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Auto-Approval</h2>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoApprove"
              checked={settings.autoApproveEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, autoApproveEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="autoApprove" className="text-neutral-700">
              Enable automatic approval for settlements under threshold
            </label>
          </div>

          {settings.autoApproveEnabled && (
            <div className="ml-8">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Auto-Approve Threshold ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.autoApproveThreshold}
                onChange={(e) => setSettings(prev => ({ ...prev, autoApproveThreshold: parseFloat(e.target.value) || 0 }))}
                className="w-64 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <p className="text-sm text-neutral-500 mt-1">
                Settlements below this amount will be automatically approved
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Notifications</h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Settlement Notification Email
          </label>
          <input
            type="email"
            value={settings.settlementNotificationEmail}
            onChange={(e) => setSettings(prev => ({ ...prev, settlementNotificationEmail: e.target.value }))}
            placeholder="finance@example.com"
            className="w-full md:w-96 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <p className="text-sm text-neutral-500 mt-1">
            Email address for settlement notifications (leave empty to disable)
          </p>
        </div>
      </div>

      {/* Webhook Settings */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Webhook Configuration</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Retry Attempts
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="1"
              value={settings.webhookRetryAttempts}
              onChange={(e) => setSettings(prev => ({ ...prev, webhookRetryAttempts: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Number of times to retry failed webhook deliveries
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Timeout (ms)
            </label>
            <input
              type="number"
              min="1000"
              max="60000"
              step="1000"
              value={settings.webhookTimeoutMs}
              onChange={(e) => setSettings(prev => ({ ...prev, webhookTimeoutMs: parseInt(e.target.value) || 10000 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Timeout for webhook delivery requests
            </p>
          </div>
        </div>
      </div>

      {/* Fee Schedule Info */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="font-medium text-blue-900 mb-2">Settlement Process</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Captures accumulate from partner transactions</li>
          <li>2. Settlement generated when minimum threshold is met (based on partner frequency)</li>
          <li>3. Settlement requires admin approval (unless auto-approved)</li>
          <li>4. Approved settlements move to PROCESSING when payment is initiated</li>
          <li>5. Settlement marked PAID when payment is confirmed</li>
        </ul>
        <p className="text-sm text-blue-800 mt-3">
          Partner-specific fee overrides and settlement frequencies can be configured on each partner&apos;s settings page.
        </p>
      </div>

      {/* Links */}
      <div className="mt-6 flex gap-4">
        <a
          href="/admin/settlements"
          className="text-primary-600 hover:underline text-sm font-medium"
        >
          View All Settlements →
        </a>
        <a
          href="/admin/partners"
          className="text-primary-600 hover:underline text-sm font-medium"
        >
          Manage Partners →
        </a>
      </div>
    </AdminLayout>
  );
}
