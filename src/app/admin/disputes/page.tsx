// app/admin/disputes/page.tsx
// Generate a chargeback-evidence zip bundle for any transaction.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface DisputeCase {
  id: string;
  transactionRef: string;
  paymentIntentId: string | null;
  vrolCase: string | null;
  partnerName: string | null;
  amountCents: number | null;
  currency: string;
  customerEmail: string | null;
  status: 'OPEN' | 'SUBMITTED' | 'WON' | 'LOST' | 'CLOSED';
  bundleCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN:      'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  WON:       'bg-green-100 text-green-800',
  LOST:      'bg-red-100 text-red-800',
  CLOSED:    'bg-neutral-100 text-neutral-700',
};
const STATUS_OPTIONS = ['OPEN', 'SUBMITTED', 'WON', 'LOST', 'CLOSED'] as const;

function formatCurrency(cents: number | null, currency: string): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function downloadBundle(transactionRef: string, vrol?: string | null) {
  const params = new URLSearchParams({ id: transactionRef });
  if (vrol) params.set('vrol', vrol);
  const res = await fetch(`/api/admin/disputes/bundle?${params}`);
  if (!res.ok) {
    let msg = `Failed to generate bundle (${res.status})`;
    try { const b = await res.json(); if (b?.error) msg = b.error; } catch { /* not json */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `dispute-evidence-${Date.now()}.zip`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return filename;
}

export default function DisputesPage() {
  const [transactionId, setTransactionId] = useState('');
  const [vrolCase, setVrolCase] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cases, setCases] = useState<DisputeCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const res = await fetch('/api/admin/disputes/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases);
      }
    } catch {
      // leave list as-is on transient error
    } finally {
      setCasesLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const id = transactionId.trim();
    if (!id) {
      setError('Enter a transaction ID first.');
      return;
    }

    setGenerating(true);
    try {
      const filename = await downloadBundle(id, vrolCase.trim() || undefined);
      setSuccess(`Downloaded ${filename}.`);
      fetchCases(); // refresh the tracking list — the bundle just logged a case
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bundle');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRedownload(c: DisputeCase) {
    setBusyId(c.id);
    setError(null);
    try {
      await downloadBundle(c.transactionRef, c.vrolCase);
      fetchCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-download');
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(c: DisputeCase, status: string) {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/disputes/cases/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: status as DisputeCase['status'] } : x)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: DisputeCase) {
    if (!confirm(`Delete the dispute record for ${c.transactionRef}? The evidence kit can still be regenerated later from the transaction ID. This only removes the tracking entry.`)) {
      return;
    }
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/disputes/cases/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCases((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b?.error || 'Failed to delete dispute record');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout
      title="Disputes"
      description="Generate a chargeback-evidence zip bundle for any DivinityCoin transaction"
    >
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">Generate evidence bundle</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Paste any of: the Stripe PaymentIntent ID (<code className="font-mono text-xs bg-neutral-100 px-1 rounded">pi_...</code>),
              the internal PendingPartnerPayment ID, or the legacy Transaction ID.
              We&apos;ll auto-detect which kind of record it is.
            </p>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label htmlFor="tx" className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Transaction ID
                </label>
                <input
                  id="tx"
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="pi_3Abc... or cmqxxx..."
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-sm font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label htmlFor="vrol" className="block text-sm font-medium text-neutral-700 mb-1.5">
                  VROL case number <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  id="vrol"
                  type="text"
                  value={vrolCase}
                  onChange={(e) => setVrolCase(e.target.value)}
                  placeholder="5565317469"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition text-sm font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Included in the response letter and instructions for easier issuer-side reference.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={generating || !transactionId.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Building bundle…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Generate &amp; download zip
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: what's in the bundle */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">What&apos;s in the zip</h3>
            <ul className="text-sm text-neutral-600 space-y-2.5">
              <li className="flex gap-2">
                <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded shrink-0 self-start">PDF</span>
                <span><strong>receipt.pdf</strong> — formatted, time-stamped receipt with delivery and redemption timeline.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded shrink-0 self-start">PDF</span>
                <span><strong>response-letter.pdf</strong> — pre-filled chargeback response (compelling-evidence cover letter).</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded shrink-0 self-start">JSON</span>
                <span><strong>raw-evidence.json</strong> — every queryable field from our DB for that transaction.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded shrink-0 self-start">TXT</span>
                <span><strong>terms-snippet.txt</strong> — the chargeback-relevant sections of our Terms of Service.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded shrink-0 self-start">MD</span>
                <span><strong>INSTRUCTIONS.md</strong> — step-by-step submission guide for the Stripe dispute UI.</span>
              </li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
            <p className="font-medium mb-2">Quick path:</p>
            <ol className="space-y-1.5 list-decimal list-inside text-amber-900/90">
              <li>Paste the PI / transaction ID</li>
              <li>Hit generate</li>
              <li>Open the zip, drag files into the Stripe dispute form per INSTRUCTIONS.md</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Tracked dispute cases */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Tracked disputes</h2>
          <button
            onClick={fetchCases}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Transaction</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Partner</th>
                  <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">VROL</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Generated</th>
                  <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {casesLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>
                ) : cases.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No dispute kits generated yet. Generate one above and it will appear here.</td></tr>
                ) : cases.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-neutral-900" title={c.transactionRef}>
                        {c.transactionRef.length > 18 ? c.transactionRef.slice(0, 18) + '…' : c.transactionRef}
                      </div>
                      {c.customerEmail && <div className="text-xs text-neutral-500">{c.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{c.partnerName ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 text-right font-mono">{formatCurrency(c.amountCents, c.currency)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-neutral-600">{c.vrolCase ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        disabled={busyId === c.id}
                        onChange={(e) => handleStatusChange(c, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer outline-none ${STATUS_STYLES[c.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                      {c.bundleCount > 1 && <span className="text-xs text-neutral-400"> · {c.bundleCount}×</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleRedownload(c)}
                        disabled={busyId === c.id}
                        className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50 mr-3"
                      >
                        {busyId === c.id ? '…' : 'Re-download'}
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={busyId === c.id}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Deleting a record only removes the tracking entry — the evidence kit is regenerated on demand from the transaction ID, never stored, so nothing is lost.
        </p>
      </div>
    </AdminLayout>
  );
}
