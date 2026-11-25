// app/admin/settings/checkout-embedding/page.tsx
// Which partner sites may show the hosted checkout inside an iframe.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface State {
  origins: string[];
  source: 'database' | 'environment' | 'none';
  header: string;
}

export default function CheckoutEmbeddingPage() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [origins, setOrigins] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/settings/checkout-embedding');
    if (res.status === 401 || res.status === 403) { router.push('/admin/login'); return; }
    const data = await res.json();
    setState(data);
    setOrigins(data.origins ?? []);
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaved('');
    const pieces = draft.split(/[\s,]+/).map((s) => s.trim().toLowerCase().replace(/\/+$/, '')).filter(Boolean);
    const bad = pieces.filter((p) => !/^https:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?$/.test(p) && !/^https?:\/\/localhost(:\d{1,5})?$/.test(p));
    if (bad.length) { setError(`Not a valid origin: ${bad.join(', ')} — use https://example.com or https://*.example.com, no path.`); return; }
    setOrigins((prev) => [...new Set([...prev, ...pieces])]);
    setDraft('');
  };

  const remove = (o: string) => { setSaved(''); setOrigins((prev) => prev.filter((x) => x !== o)); };

  const save = async () => {
    setError(''); setSaved(''); setBusy(true);
    const res = await fetch('/api/admin/settings/checkout-embedding', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origins }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Failed to save'); return; }
    setState(data); setOrigins(data.origins);
    setSaved('Saved. Live on /checkout within about two minutes — no restart needed.');
  };

  if (!state) return <div className="p-8 text-neutral-500">Loading…</div>;
  const dirty = JSON.stringify(origins) !== JSON.stringify(state.origins);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Checkout Embedding</h1>
        <p className="text-neutral-600 mt-1">
          Sites listed here may show the Divinity Payments hosted checkout inside an iframe on their own pages.
          Anything not listed gets a blank frame. Add a partner&apos;s site before they turn on embedded checkout.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {saved && <div className="bg-green-50 text-green-800 px-4 py-3 rounded-lg text-sm">{saved}</div>}

      <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-neutral-900 mb-1">Authorized sites</h2>
          <p className="text-xs text-neutral-500 mb-3">
            Currently from {state.source === 'database' ? 'this page' : state.source === 'environment' ? 'the server environment (CHECKOUT_FRAME_ANCESTORS) — saving here takes over' : 'nowhere — embedding is off'}.
          </p>
          {origins.length === 0 && <p className="text-sm text-neutral-500">None. The checkout can only be opened directly, not embedded.</p>}
          <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
            {origins.map((o) => (
              <li key={o} className="flex items-center justify-between px-4 py-2">
                <code className="font-mono text-sm text-neutral-800">{o}</code>
                <button type="button" onClick={() => remove(o)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={add} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://partner.example.com  (or https://*.example.com)"
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden font-mono text-sm"
          />
          <Button type="submit" variant="outline">Add</Button>
        </form>
        <p className="text-xs text-neutral-500">
          Include both the bare domain and <code className="font-mono">www.</code> if a partner uses both. A wildcard covers subdomains only, not the bare domain.
        </p>

        <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
          <Button onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</Button>
          {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
        </div>
      </div>

      <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6">
        <h2 className="font-semibold text-neutral-900 mb-2">What browsers will receive</h2>
        <p className="text-xs text-neutral-500 mb-2">The <code className="font-mono">Content-Security-Policy</code> header on every <code className="font-mono">/checkout/*</code> response, after saving:</p>
        <code className="block font-mono text-sm bg-white border border-neutral-200 rounded-lg px-3 py-2 break-all">
          {origins.length > 0 ? `frame-ancestors 'self' ${origins.join(' ')}` : "frame-ancestors 'none'"}
        </code>
      </div>
    </div>
  );
}
