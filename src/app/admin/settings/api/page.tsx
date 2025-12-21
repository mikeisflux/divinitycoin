// app/admin/settings/api/page.tsx
// API Keys settings page (client component for interactivity)

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface ApiKeyConfig {
  key: string;
  label: string;
  description: string;
  category: string;
  hasValue: boolean;
  maskedValue: string;
}

export default function ApiKeysSettingsPage() {
  const [configs, setConfigs] = useState<ApiKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/settings/configs');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${key} updated successfully` });
        setEditingKey(null);
        setEditValue('');
        await fetchConfigs();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Are you sure you want to delete ${key}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/settings/configs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${key} deleted successfully` });
        await fetchConfigs();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete configuration' });
    }
  };

  const apiKeyDefinitions: ApiKeyConfig[] = [
    { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key', description: 'Your Stripe API secret key (starts with sk_)', category: 'stripe', hasValue: false, maskedValue: '' },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook Secret', description: 'Webhook signing secret from Stripe dashboard', category: 'stripe', hasValue: false, maskedValue: '' },
    { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable Key', description: 'Your Stripe publishable key (starts with pk_)', category: 'stripe', hasValue: false, maskedValue: '' },
    { key: 'INTERNAL_API_KEY', label: 'Internal API Key', description: 'Secret key for partner API authentication', category: 'internal', hasValue: false, maskedValue: '' },
  ];

  const mergedConfigs = apiKeyDefinitions.map(def => {
    const saved = configs.find(c => c.key === def.key);
    return {
      ...def,
      hasValue: saved?.hasValue || false,
      maskedValue: saved?.maskedValue || '',
    };
  });

  const categories = [
    { id: 'stripe', label: 'Stripe', description: 'Payment processing configuration' },
    { id: 'internal', label: 'Internal API', description: 'Partner integration configuration' },
  ];

  if (loading) {
    return (
      <AdminLayout title="API Keys" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="API Keys" description="Manage API keys and secrets securely">
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="font-medium text-yellow-800">Security Notice</h4>
            <p className="text-sm text-yellow-700 mt-1">
              API keys are encrypted before storage and never exposed in client-side code.
              Only masked versions are shown in this interface.
            </p>
          </div>
        </div>
      </div>

      {categories.map(category => (
        <div key={category.id} className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">{category.label}</h2>
            <p className="text-neutral-600 text-sm">{category.description}</p>
          </div>

          <div className="space-y-4">
            {mergedConfigs.filter(c => c.category === category.id).map(config => (
              <div key={config.key} className="border border-neutral-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-neutral-900">{config.label}</h3>
                      {config.hasValue && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Configured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">{config.description}</p>
                    {config.hasValue && config.maskedValue && (
                      <p className="text-sm font-mono text-neutral-600 mt-2 bg-neutral-50 px-2 py-1 rounded inline-block">
                        {config.maskedValue}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {editingKey === config.key ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingKey(null);
                            setEditValue('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(config.key)}
                          disabled={saving === config.key}
                        >
                          {saving === config.key ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingKey(config.key);
                            setEditValue('');
                          }}
                        >
                          {config.hasValue ? 'Update' : 'Add'}
                        </Button>
                        {config.hasValue && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(config.key)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {editingKey === config.key && (
                  <div className="mt-4">
                    <input
                      type="password"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={`Enter ${config.label}`}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition font-mono text-sm"
                      autoComplete="off"
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                      This value will be encrypted before storage
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </AdminLayout>
  );
}
