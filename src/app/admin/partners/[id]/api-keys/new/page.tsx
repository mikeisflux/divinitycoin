// app/admin/partners/[id]/api-keys/new/page.tsx
// Generate new API key for partner

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface Partner {
  id: string;
  name: string;
  slug: string;
}

const keyTypes = [
  { id: 'api', name: 'API Key', description: 'Standard API key for server-to-server requests' },
  { id: 'public', name: 'Public Key', description: 'For client-side SDK initialization (read-only)' },
  { id: 'private', name: 'Private Key', description: 'Full access key for sensitive operations' },
  { id: 'oauth', name: 'OAuth Client', description: 'OAuth 2.0 client credentials' },
];

export default function NewPartnerApiKeyPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [keyType, setKeyType] = useState('api');
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  async function handleGenerate() {
    if (!keyName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name for the API key' });
      return;
    }

    setGenerating(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName, type: keyType }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to generate API key' });
        return;
      }

      setGeneratedKey(data.key);
      setMessage({ type: 'success', text: 'API key generated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to generate API key' });
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
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

  return (
    <AdminLayout
      title="Generate API Key"
      description={`Create new API key for ${partner.name}`}
      actions={
        <Link
          href={`/admin/partners/${partnerId}`}
          className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-300 transition"
        >
          Back to Partner
        </Link>
      }
    >
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {generatedKey ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">API Key Generated</h3>
              <p className="text-sm text-neutral-500">{keyTypes.find(k => k.id === keyType)?.name}</p>
            </div>
          </div>

          <div className="bg-neutral-100 rounded-lg p-4 mb-4">
            <p className="text-xs text-neutral-500 mb-2">Your new API key (copy now - it won&apos;t be shown again):</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-neutral-900 flex-1 break-all">{generatedKey}</code>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> This is the only time you&apos;ll see this key.
              Store it securely and never share it publicly.
            </p>
          </div>

          <div className="flex gap-4">
            <Button onClick={() => {
              setGeneratedKey(null);
              setKeyName('');
              setMessage(null);
            }}>
              Generate Another
            </Button>
            <Link
              href={`/admin/partners/${partnerId}`}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition"
            >
              Back to Partner
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Select Key Type</h2>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
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

          <div className="mb-6">
            <label htmlFor="keyName" className="block text-sm font-medium text-neutral-700 mb-1">
              Key Name *
            </label>
            <input
              type="text"
              id="keyName"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Production, Staging, Test"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div className="flex gap-4">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Key'}
            </Button>
            <Link
              href={`/admin/partners/${partnerId}`}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition"
            >
              Cancel
            </Link>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
