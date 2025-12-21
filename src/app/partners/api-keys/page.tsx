// app/partners/api-keys/page.tsx
// Partner API keys management

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ApiKey {
  id: string;
  name: string;
  type: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: string;
  expiresAt: string | null;
}

export default function PartnerApiKeysPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNewKey, setShowNewKey] = useState<{ key: string; type: string } | null>(null);
  const [keyType, setKeyType] = useState('api');
  const [keyName, setKeyName] = useState('');

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/partners/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      } else if (response.status === 401) {
        router.push('/partners/login');
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    if (!keyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch('/api/partners/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName, type: keyType }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowNewKey({ key: data.key, type: keyType });
        setKeyName('');
        await fetchApiKeys();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to generate key');
      }
    } catch (error) {
      alert('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/partners/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchApiKeys();
      } else {
        alert('Failed to revoke key');
      }
    } catch (error) {
      alert('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const keyTypes = [
    { id: 'api', name: 'API Key', description: 'Standard API key for server-to-server requests' },
    { id: 'public', name: 'Public Key', description: 'For client-side SDK initialization (read-only)' },
    { id: 'private', name: 'Private Key', description: 'Full access key for sensitive operations' },
    { id: 'oauth', name: 'OAuth Client', description: 'OAuth 2.0 client credentials' },
  ];

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
              <h1 className="text-xl font-semibold text-neutral-900">API Keys</h1>
              <p className="text-sm text-neutral-500">Generate and manage your integration credentials</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* New Key Modal */}
        {showNewKey && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">API Key Generated</h3>
                  <p className="text-sm text-neutral-500">{keyTypes.find(k => k.id === showNewKey.type)?.name}</p>
                </div>
              </div>

              <div className="bg-neutral-100 rounded-lg p-4 mb-4">
                <p className="text-xs text-neutral-500 mb-2">Your new API key (copy now - it won't be shown again):</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-neutral-900 flex-1 break-all">{showNewKey.key}</code>
                  <button
                    onClick={() => copyToClipboard(showNewKey.key)}
                    className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> This is the only time you'll see this key.
                  Store it securely and never share it publicly.
                </p>
              </div>

              <button
                onClick={() => setShowNewKey(null)}
                className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
              >
                I've Saved My Key
              </button>
            </div>
          </div>
        )}

        {/* Generate New Key */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Generate New Key</h2>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {keyTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setKeyType(type.id)}
                className={`text-left p-4 rounded-lg border-2 transition ${
                  keyType === type.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <h4 className="font-medium text-neutral-900">{type.name}</h4>
                <p className="text-xs text-neutral-500 mt-1">{type.description}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name (e.g., Production, Staging)"
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <button
              onClick={generateKey}
              disabled={generating}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        </div>

        {/* Existing Keys */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">Your API Keys</h2>
          </div>

          {apiKeys.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-neutral-500">No API keys yet. Generate your first key above.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Key</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Requests</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{key.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                        {key.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-600">{key.keyPrefix}...</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {key.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{key.requestCount}</td>
                    <td className="px-6 py-4 text-right">
                      {key.isActive && (
                        <button
                          onClick={() => revokeKey(key.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
