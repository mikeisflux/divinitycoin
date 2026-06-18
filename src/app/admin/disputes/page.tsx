// app/admin/disputes/page.tsx
// Generate a chargeback-evidence zip bundle for any transaction.

'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function DisputesPage() {
  const [transactionId, setTransactionId] = useState('');
  const [vrolCase, setVrolCase] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const params = new URLSearchParams({ id });
      if (vrolCase.trim()) params.set('vrol', vrolCase.trim());

      const res = await fetch(`/api/admin/disputes/bundle?${params}`);

      if (!res.ok) {
        let msg = `Failed to generate bundle (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {
          // not JSON
        }
        setError(msg);
        return;
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

      setSuccess(`Downloaded ${filename}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bundle');
    } finally {
      setGenerating(false);
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
    </AdminLayout>
  );
}
