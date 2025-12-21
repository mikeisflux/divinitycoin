// app/admin/settings/payments/page.tsx
// Payment settings page (amounts + Stripe API keys)

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

interface StripeSettings {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  isConfigured: boolean;
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    minAmount: 5,
    maxAmount: 500,
    presetAmounts: [10, 25, 50, 100, 250],
    currency: 'USD',
  });
  const [stripeSettings, setStripeSettings] = useState<StripeSettings>({
    secretKey: '',
    publishableKey: '',
    webhookSecret: '',
    isConfigured: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stripeMessage, setStripeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPreset, setNewPreset] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [paymentRes, stripeRes] = await Promise.all([
        fetch('/api/admin/settings/payments'),
        fetch('/api/admin/settings/stripe'),
      ]);

      if (paymentRes.ok) {
        const data = await paymentRes.json();
        setSettings(data.settings);
      }

      if (stripeRes.ok) {
        const data = await stripeRes.json();
        setStripeSettings(data.settings);
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

  const handleSaveStripe = async () => {
    setSavingStripe(true);
    setStripeMessage(null);

    try {
      const response = await fetch('/api/admin/settings/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripeSettings),
      });

      if (response.ok) {
        setStripeMessage({ type: 'success', text: 'Stripe settings saved successfully' });
        // Refresh to get masked values
        const res = await fetch('/api/admin/settings/stripe');
        if (res.ok) {
          const data = await res.json();
          setStripeSettings(data.settings);
        }
      } else {
        const data = await response.json();
        setStripeMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setStripeMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSavingStripe(false);
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
      description="Configure Stripe and payment options"
    >
      {/* Stripe API Keys Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Stripe API Keys</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {stripeSettings.isConfigured ? (
                <span className="text-green-600">Stripe is configured</span>
              ) : (
                <span className="text-amber-600">Stripe is not configured - payments will not work</span>
              )}
            </p>
          </div>
          <Button onClick={handleSaveStripe} disabled={savingStripe}>
            {savingStripe ? 'Saving...' : 'Save Stripe Settings'}
          </Button>
        </div>

        {stripeMessage && (
          <div className={`mb-6 p-4 rounded-lg ${stripeMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {stripeMessage.text}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Publishable Key (pk_...)
            </label>
            <input
              type="text"
              value={stripeSettings.publishableKey}
              onChange={(e) => setStripeSettings(prev => ({ ...prev, publishableKey: e.target.value }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm"
              placeholder="pk_live_..."
            />
            <p className="text-sm text-neutral-500 mt-1">Used for client-side Stripe integration</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Secret Key (sk_...)
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={stripeSettings.secretKey}
                onChange={(e) => setStripeSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                className="w-full px-4 py-2 pr-12 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm"
                placeholder="sk_live_..."
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                {showSecretKey ? (
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
            <p className="text-sm text-neutral-500 mt-1">Used for server-side API calls. Keep this secret!</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Webhook Secret (whsec_...)
            </label>
            <div className="relative">
              <input
                type={showWebhookSecret ? 'text' : 'password'}
                value={stripeSettings.webhookSecret}
                onChange={(e) => setStripeSettings(prev => ({ ...prev, webhookSecret: e.target.value }))}
                className="w-full px-4 py-2 pr-12 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm"
                placeholder="whsec_..."
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
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
            <p className="text-sm text-neutral-500 mt-1">
              Used to verify webhook events. Get this from{' '}
              <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                Stripe Dashboard → Webhooks
              </a>
            </p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="font-medium text-blue-900 mb-2">Webhook Setup</h4>
          <p className="text-sm text-blue-800 mb-2">
            Configure your Stripe webhook endpoint to:
          </p>
          <code className="block bg-blue-100 px-3 py-2 rounded text-sm text-blue-900 mb-2">
            https://divinitycoin.com/api/webhook/stripe
          </code>
          <p className="text-sm text-blue-800">
            Events to listen for: <code className="bg-blue-100 px-1 rounded">checkout.session.completed</code>
          </p>
        </div>
      </div>

      {/* Amount Settings Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-900">Amount Limits</h2>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Amount Settings'}
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
