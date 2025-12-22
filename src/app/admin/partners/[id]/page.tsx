// app/admin/partners/[id]/page.tsx
// Partner detail page with working actions

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface PartnerApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  requestCount: bigint | string;
}

interface Partner {
  id: string;
  name: string;
  slug: string;
  status: string;
  sandboxMode: boolean;
  contactName: string | null;
  contactEmail: string | null;
  website: string | null;
  vpnIp: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  description: string | null;
  createdAt: string;
  activatedAt: string | null;
  settings: Record<string, unknown> | null;
  apiKeys: PartnerApiKey[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    DEACTIVATED: 'bg-neutral-100 text-neutral-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<Array<{
    id: string;
    method: string;
    endpoint: string;
    path: string;
    ipAddress: string;
    statusCode: number;
    responseTimeMs: number;
    errorMessage: string | null;
    timestamp: string;
  }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [regeneratingSecret, setRegeneratingSecret] = useState(false);
  const [togglingSandbox, setTogglingSandbox] = useState(false);
  const [editingWebhookUrl, setEditingWebhookUrl] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [savingWebhookUrl, setSavingWebhookUrl] = useState(false);
  const [keyActionLoading, setKeyActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPartner();
  }, [partnerId]);

  async function fetchPartner() {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`);
      if (response.ok) {
        const data = await response.json();
        setPartner(data.partner);
      } else if (response.status === 404) {
        router.push('/admin/partners');
      }
    } catch (err) {
      console.error('Failed to fetch partner:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to activate partner' });
        return;
      }

      setMessage({ type: 'success', text: 'Partner activated successfully!' });
      setSetupUrl(data.setupUrl);
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to activate partner' });
    } finally {
      setActivating(false);
    }
  }

  async function handleSuspend() {
    if (!confirm('Are you sure you want to suspend this partner?')) return;

    setSuspending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to suspend partner' });
        return;
      }

      setMessage({ type: 'success', text: 'Partner suspended' });
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to suspend partner' });
    } finally {
      setSuspending(false);
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/test-webhook`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({
          type: 'error',
          text: data.error || `Webhook test failed (Status: ${data.statusCode || 'unknown'})`,
        });
        return;
      }

      setMessage({
        type: 'success',
        text: `Webhook test successful! Response time: ${data.durationMs}ms`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send test webhook' });
    } finally {
      setTestingWebhook(false);
    }
  }

  async function handleRegenerateSecret() {
    if (!confirm('Are you sure? This will invalidate the current webhook secret. The partner will need to update their integration.')) {
      return;
    }

    setRegeneratingSecret(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/webhook-secret`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to regenerate webhook secret' });
        return;
      }

      setMessage({ type: 'success', text: 'Webhook secret regenerated! Make sure to share the new secret with the partner.' });
      setShowWebhookSecret(true);
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to regenerate webhook secret' });
    } finally {
      setRegeneratingSecret(false);
    }
  }

  async function handleToggleSandbox() {
    const newMode = !partner?.sandboxMode;
    const modeText = newMode ? 'sandbox' : 'live';

    if (!newMode && !confirm(`Are you sure you want to switch to LIVE mode? This will enable real transactions.`)) {
      return;
    }

    setTogglingSandbox(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxMode: newMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to toggle sandbox mode' });
        return;
      }

      setMessage({ type: 'success', text: `Partner switched to ${modeText} mode` });
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to toggle sandbox mode' });
    } finally {
      setTogglingSandbox(false);
    }
  }

  async function handleSaveWebhookUrl() {
    setSavingWebhookUrl(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrlInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save webhook URL' });
        return;
      }

      setMessage({ type: 'success', text: 'Webhook URL saved!' });
      setEditingWebhookUrl(false);
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save webhook URL' });
    } finally {
      setSavingWebhookUrl(false);
    }
  }

  async function handleToggleKeyStatus(keyId: string, currentlyActive: boolean) {
    const action = currentlyActive ? 'revoke' : 'reactivate';
    if (currentlyActive && !confirm(`Are you sure you want to revoke this API key? It will immediately stop working.`)) {
      return;
    }

    setKeyActionLoading(keyId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/api-keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || `Failed to ${action} API key` });
        return;
      }

      setMessage({ type: 'success', text: `API key ${action}d successfully` });
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to ${action} API key` });
    } finally {
      setKeyActionLoading(null);
    }
  }

  async function handleDeleteKey(keyId: string, keyName: string) {
    if (!confirm(`Are you sure you want to permanently delete the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    setKeyActionLoading(keyId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete API key' });
        return;
      }

      setMessage({ type: 'success', text: 'API key deleted successfully' });
      fetchPartner();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    } finally {
      setKeyActionLoading(null);
    }
  }

  async function fetchLogs() {
    setLogsLoading(true);
    setShowLogsModal(true);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/logs?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Loading..." description="Please wait">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!partner) {
    return (
      <AdminLayout title="Partner Not Found" description="">
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">This partner does not exist.</p>
          <Button onClick={() => router.push('/admin/partners')}>Back to Partners</Button>
        </div>
      </AdminLayout>
    );
  }

  const settings = partner.settings as Record<string, unknown> | null;

  return (
    <AdminLayout
      title={partner.name}
      description={`Partner details for ${partner.slug}`}
      actions={
        <Link
          href={`/admin/partners/${partner.id}/edit`}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          Edit Partner
        </Link>
      }
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {setupUrl && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Partner Setup URL</h4>
          <p className="text-sm text-blue-800 mb-2">Send this link to the partner to complete their account setup:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border text-sm break-all">{setupUrl}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setupUrl);
                alert('Copied to clipboard!');
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Partner Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Partner Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <dt className="text-sm text-neutral-500">Partner ID</dt>
                <dd className="flex items-center gap-2">
                  <code className="text-neutral-900 font-mono text-sm bg-neutral-100 px-2 py-1 rounded">{partner.id}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(partner.id);
                      setMessage({ type: 'success', text: 'Partner ID copied to clipboard!' });
                      setTimeout(() => setMessage(null), 2000);
                    }}
                    className="text-xs px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded transition"
                  >
                    Copy
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Name</dt>
                <dd className="text-neutral-900 font-medium">{partner.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Slug</dt>
                <dd className="text-neutral-900 font-mono">{partner.slug}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Status</dt>
                <dd><StatusBadge status={partner.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Mode</dt>
                <dd className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    partner.sandboxMode
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {partner.sandboxMode ? 'SANDBOX' : 'LIVE'}
                  </span>
                  <button
                    onClick={handleToggleSandbox}
                    disabled={togglingSandbox}
                    className="text-xs px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded transition disabled:opacity-50"
                  >
                    {togglingSandbox ? 'Switching...' : partner.sandboxMode ? 'Go Live' : 'Switch to Sandbox'}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Created</dt>
                <dd className="text-neutral-900">{new Date(partner.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Contact Name</dt>
                <dd className="text-neutral-900">{partner.contactName || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Contact Email</dt>
                <dd className="text-neutral-900">{partner.contactEmail || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Website</dt>
                <dd className="text-neutral-900">
                  {partner.website ? (
                    <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {partner.website}
                    </a>
                  ) : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">VPN IP</dt>
                <dd className="text-neutral-900 font-mono">{partner.vpnIp || 'Not configured'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-neutral-500 mb-1">Webhook URL</dt>
                <dd>
                  {editingWebhookUrl ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        placeholder="https://your-server.com/webhook/divinitycoin"
                        className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                      <button
                        onClick={handleSaveWebhookUrl}
                        disabled={savingWebhookUrl}
                        className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {savingWebhookUrl ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingWebhookUrl(false)}
                        className="px-3 py-2 bg-neutral-200 text-neutral-700 text-sm rounded-lg hover:bg-neutral-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-900 text-sm break-all">
                        {partner.webhookUrl || 'Not configured'}
                      </span>
                      <button
                        onClick={() => {
                          setWebhookUrlInput(partner.webhookUrl || '');
                          setEditingWebhookUrl(true);
                        }}
                        className="text-xs px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded transition"
                      >
                        {partner.webhookUrl ? 'Edit' : 'Set URL'}
                      </button>
                    </div>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-neutral-500 mb-1">Webhook Secret</dt>
                <dd className="flex items-center gap-2">
                  {partner.webhookSecret ? (
                    <>
                      <code className="flex-1 text-neutral-900 font-mono text-sm bg-neutral-100 px-3 py-2 rounded break-all">
                        {showWebhookSecret ? partner.webhookSecret : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="text-xs px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded transition"
                        title={showWebhookSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showWebhookSecret ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(partner.webhookSecret!);
                          setMessage({ type: 'success', text: 'Webhook secret copied to clipboard!' });
                          setTimeout(() => setMessage(null), 2000);
                        }}
                        className="text-xs px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded transition"
                      >
                        Copy
                      </button>
                      <button
                        onClick={handleRegenerateSecret}
                        disabled={regeneratingSecret}
                        className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 rounded transition disabled:opacity-50"
                      >
                        {regeneratingSecret ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    </>
                  ) : (
                    <span className="text-neutral-500 text-sm">Not generated</span>
                  )}
                </dd>
              </div>
              {partner.description && (
                <div className="col-span-2">
                  <dt className="text-sm text-neutral-500">Description</dt>
                  <dd className="text-neutral-900 text-sm">{partner.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Application Details (if pending) */}
          {settings && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Application Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                {Boolean(settings.businessType) && (
                  <div>
                    <dt className="text-sm text-neutral-500">Business Type</dt>
                    <dd className="text-neutral-900">{String(settings.businessType)}</dd>
                  </div>
                )}
                {Boolean(settings.taxId) && (
                  <div>
                    <dt className="text-sm text-neutral-500">Tax ID</dt>
                    <dd className="text-neutral-900 font-mono">{String(settings.taxId)}</dd>
                  </div>
                )}
                {Boolean(settings.phone) && (
                  <div>
                    <dt className="text-sm text-neutral-500">Phone</dt>
                    <dd className="text-neutral-900">{String(settings.phone)}</dd>
                  </div>
                )}
                {Boolean(settings.expectedMonthlyVolume) && (
                  <div>
                    <dt className="text-sm text-neutral-500">Expected Monthly Volume</dt>
                    <dd className="text-neutral-900">{String(settings.expectedMonthlyVolume)}</dd>
                  </div>
                )}
                {Boolean(settings.address) && typeof settings.address === 'object' && (
                  <div className="col-span-2">
                    <dt className="text-sm text-neutral-500">Address</dt>
                    <dd className="text-neutral-900">
                      {(settings.address as any).line1}
                      {(settings.address as any).line2 && `, ${(settings.address as any).line2}`}
                      <br />
                      {(settings.address as any).city}, {(settings.address as any).state} {(settings.address as any).zipCode}
                      <br />
                      {(settings.address as any).country}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* API Keys */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">API Keys</h2>
              <Link
                href={`/admin/partners/${partner.id}/api-keys/new`}
                className="text-sm text-primary-600 hover:underline"
              >
                Generate New Key
              </Link>
            </div>

            {partner.apiKeys.length === 0 ? (
              <p className="text-neutral-500 text-sm">No API keys generated yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-neutral-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Name</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Key Prefix</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Last Used</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Requests</th>
                    <th className="text-right text-xs font-medium text-neutral-500 uppercase py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {partner.apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="py-3 text-sm text-neutral-900">{key.name}</td>
                      <td className="py-3 text-sm font-mono text-neutral-600">{key.keyPrefix}...</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-neutral-500">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 text-sm text-neutral-600">{String(key.requestCount)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleKeyStatus(key.id, key.isActive)}
                            disabled={keyActionLoading === key.id}
                            className={`text-xs px-2 py-1 rounded transition disabled:opacity-50 ${
                              key.isActive
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                          >
                            {keyActionLoading === key.id ? '...' : key.isActive ? 'Revoke' : 'Reactivate'}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id, key.name)}
                            disabled={keyActionLoading === key.id}
                            className="text-xs px-2 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded transition disabled:opacity-50"
                          >
                            {keyActionLoading === key.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {partner.status === 'PENDING' && (
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-green-600 hover:bg-green-50 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {activating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      Activating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Activate Partner
                    </>
                  )}
                </button>
              )}
              {partner.status === 'ACTIVE' && (
                <button
                  onClick={handleSuspend}
                  disabled={suspending}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {suspending ? 'Suspending...' : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Suspend Partner
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleTestWebhook}
                disabled={testingWebhook || !partner.webhookUrl}
                className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingWebhook ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-600"></div>
                    Testing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Test Webhook
                  </>
                )}
              </button>
              <button
                onClick={fetchLogs}
                className="w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-neutral-50 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View API Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">API Request Logs</h3>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : logs.length === 0 ? (
                <p className="text-neutral-500 text-center py-8">No API logs found for this partner.</p>
              ) : (
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Timestamp</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Method</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Endpoint</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Status</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">Time</th>
                      <th className="text-left text-xs font-medium text-neutral-500 uppercase py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 text-sm text-neutral-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            log.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                            log.method === 'POST' ? 'bg-green-100 text-green-800' :
                            log.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            log.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-2 text-sm font-mono text-neutral-900 max-w-xs truncate">
                          {log.endpoint}
                        </td>
                        <td className="py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            log.statusCode >= 200 && log.statusCode < 300 ? 'bg-green-100 text-green-800' :
                            log.statusCode >= 400 && log.statusCode < 500 ? 'bg-yellow-100 text-yellow-800' :
                            log.statusCode >= 500 ? 'bg-red-100 text-red-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="py-2 text-sm text-neutral-600">{log.responseTimeMs}ms</td>
                        <td className="py-2 text-sm font-mono text-neutral-500">{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
