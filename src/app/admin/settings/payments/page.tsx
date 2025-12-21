// app/admin/settings/payments/page.tsx
// Payment settings page

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface PaymentSettings {
  minAmount: number;
  maxAmount: number;
  presetAmounts: number[];
  currency: string;
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    minAmount: 5,
    maxAmount: 500,
    presetAmounts: [10, 25, 50, 100, 250],
    currency: 'USD',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPreset, setNewPreset] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/payments');
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
      const response = await fetch('/api/admin/settings/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Payment settings saved successfully' });
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

  const addPreset = () => {
    const amount = parseFloat(newPreset);
    if (amount > 0 && !settings.presetAmounts.includes(amount)) {
      setSettings(prev => ({
        ...prev,
        presetAmounts: [...prev.presetAmounts, amount].sort((a, b) => a - b),
      }));
      setNewPreset('');
    }
  };

  const removePreset = (amount: number) => {
    setSettings(prev => ({
      ...prev,
      presetAmounts: prev.presetAmounts.filter(a => a !== amount),
    }));
  };

  if (loading) {
    return (
      <AdminLayout title="Payment Settings" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Payment Settings"
      description="Configure payment amounts and options"
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
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Amount Limits</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Minimum Amount ($)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.minAmount}
              onChange={(e) => setSettings(prev => ({ ...prev, minAmount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">Minimum purchase amount allowed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Maximum Amount ($)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.maxAmount}
              onChange={(e) => setSettings(prev => ({ ...prev, maxAmount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">Maximum purchase amount allowed</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Preset Amounts</h2>

        <div className="flex flex-wrap gap-3 mb-6">
          {settings.presetAmounts.map(amount => (
            <div
              key={amount}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg"
            >
              <span className="font-medium">${amount}</span>
              <button
                onClick={() => removePreset(amount)}
                className="text-primary-500 hover:text-primary-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            min="1"
            step="1"
            value={newPreset}
            onChange={(e) => setNewPreset(e.target.value)}
            placeholder="Enter amount"
            className="w-32 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <Button variant="outline" onClick={addPreset}>
            Add Preset
          </Button>
        </div>
        <p className="text-sm text-neutral-500 mt-2">
          These amounts will be shown as quick-select buttons on the checkout page
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Currency</h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Currency Code
          </label>
          <select
            value={settings.currency}
            onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full md:w-48 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
          <p className="text-sm text-neutral-500 mt-1">Currency for all transactions</p>
        </div>
      </div>
    </AdminLayout>
  );
}
