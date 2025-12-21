// app/admin/settings/security/page.tsx
// Security settings page

'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

interface SecuritySettings {
  rateLimitWindowMs: number;
  rateLimitMaxAttempts: number;
  adminSessionExpiryHours: number;
  adminMaxLoginAttempts: number;
  adminLockoutMinutes: number;
  requireMfa: boolean;
}

export default function SecuritySettingsPage() {
  const [settings, setSettings] = useState<SecuritySettings>({
    rateLimitWindowMs: 60000,
    rateLimitMaxAttempts: 5,
    adminSessionExpiryHours: 8,
    adminMaxLoginAttempts: 5,
    adminLockoutMinutes: 30,
    requireMfa: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/security');
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
      const response = await fetch('/api/admin/settings/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Security settings saved successfully' });
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
      <AdminLayout title="Security Settings" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Security Settings"
      description="Configure security policies and rate limiting"
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
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Rate Limiting</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Rate Limit Window (ms)
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={settings.rateLimitWindowMs}
              onChange={(e) => setSettings(prev => ({ ...prev, rateLimitWindowMs: parseInt(e.target.value) || 60000 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Time window for rate limiting ({settings.rateLimitWindowMs / 1000} seconds)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Max Attempts per Window
            </label>
            <input
              type="number"
              min="1"
              value={settings.rateLimitMaxAttempts}
              onChange={(e) => setSettings(prev => ({ ...prev, rateLimitMaxAttempts: parseInt(e.target.value) || 5 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Maximum redemption attempts per IP/code
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Admin Session Security</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Session Expiry (hours)
            </label>
            <input
              type="number"
              min="1"
              max="72"
              value={settings.adminSessionExpiryHours}
              onChange={(e) => setSettings(prev => ({ ...prev, adminSessionExpiryHours: parseInt(e.target.value) || 8 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Admin sessions expire after this time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Max Login Attempts
            </label>
            <input
              type="number"
              min="3"
              max="10"
              value={settings.adminMaxLoginAttempts}
              onChange={(e) => setSettings(prev => ({ ...prev, adminMaxLoginAttempts: parseInt(e.target.value) || 5 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              Failed attempts before lockout
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Lockout Duration (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={settings.adminLockoutMinutes}
              onChange={(e) => setSettings(prev => ({ ...prev, adminLockoutMinutes: parseInt(e.target.value) || 30 }))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-sm text-neutral-500 mt-1">
              How long to lock account after failed attempts
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Multi-Factor Authentication</h2>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-neutral-900">Require MFA for All Admins</h3>
            <p className="text-sm text-neutral-500 mt-1">
              When enabled, all admin users must set up 2FA to access the admin panel
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireMfa}
              onChange={(e) => setSettings(prev => ({ ...prev, requireMfa: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>
    </AdminLayout>
  );
}
