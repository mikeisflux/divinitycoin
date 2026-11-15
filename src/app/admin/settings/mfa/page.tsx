// app/admin/settings/mfa/page.tsx
// Set up, inspect or disable the signed-in admin's second factor.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface Status {
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
  pendingEnrollment: boolean;
  requiredForAll: boolean;
  email: string;
}

const inputClass =
  'w-full max-w-xs px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden font-mono tracking-widest';

export default function MfaSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [enroll, setEnroll] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/auth/mfa/status');
    if (res.status === 401) { router.push('/admin/login'); return; }
    setStatus(await res.json());
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (url: string, body?: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };

  const begin = async () => {
    setError(''); setBusy(true);
    const { ok, data } = await post('/api/admin/auth/mfa/setup');
    setBusy(false);
    if (!ok) { setError(data.error || 'Could not start enrolment'); return; }
    setEnroll({ qrDataUrl: data.qrDataUrl, secret: data.secret });
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    const { ok, data } = await post('/api/admin/auth/mfa/confirm', { code });
    setBusy(false); setCode('');
    if (!ok) { setError(data.error || 'Invalid code'); return; }
    setRecoveryCodes(data.recoveryCodes || []);
    setEnroll(null);
    await load();
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    const { ok, data } = await post('/api/admin/auth/mfa/disable', { code });
    setBusy(false); setCode('');
    if (!ok) { setError(data.error || 'Could not disable'); return; }
    setRecoveryCodes(null);
    await load();
  };

  if (!status) return <div className="p-8 text-neutral-500">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Two-Factor Authentication</h1>
        <p className="text-neutral-600 mt-1">A code from an authenticator app is required at sign-in, in addition to your password. Account: <span className="font-mono">{status.email}</span></p>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {recoveryCodes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Save your recovery codes now</h2>
          <p className="text-sm text-neutral-700">Each works once if you lose your phone. They will not be shown again.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {recoveryCodes.map((c) => <code key={c} className="font-mono text-sm bg-white rounded-sm px-3 py-2 text-center border border-amber-200 select-all">{c}</code>)}
          </div>
          <Button onClick={() => setRecoveryCodes(null)}>I&apos;ve saved them</Button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">Status</h2>
            <p className="text-sm text-neutral-600">
              {status.enabled
                ? <>Enabled since {status.enrolledAt ? new Date(status.enrolledAt).toLocaleString() : '—'} · {status.recoveryCodesRemaining} recovery {status.recoveryCodesRemaining === 1 ? 'code' : 'codes'} remaining</>
                : 'Not enabled'}
              {status.requiredForAll && <> · <span className="text-amber-700">required for all admins</span></>}
            </p>
          </div>
          <span className={`text-xs font-mono px-2 py-1 rounded-sm ${status.enabled ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-700'}`}>{status.enabled ? 'ON' : 'OFF'}</span>
        </div>

        {!status.enabled && !enroll && (
          <Button onClick={begin} disabled={busy}>{busy ? 'Starting…' : 'Set up two-factor authentication'}</Button>
        )}

        {!status.enabled && enroll && (
          <form onSubmit={confirm} className="space-y-4">
            <ol className="text-sm text-neutral-700 space-y-3 list-decimal pl-5">
              <li>Open an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator).</li>
              <li>
                Scan this code:
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enroll.qrDataUrl} alt="Authenticator QR code" width={220} height={220} className="border border-neutral-200 rounded-lg" />
                </div>
                <p className="mt-2 text-xs text-neutral-500">Can&apos;t scan? Enter this key manually:</p>
                <p className="font-mono text-sm bg-neutral-100 rounded-sm px-2 py-1 mt-1 break-all select-all max-w-md">{enroll.secret}</p>
              </li>
              <li>Enter the 6-digit code it shows:</li>
            </ol>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required className={inputClass} placeholder="123456" />
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Turn on'}</Button>
              <Button type="button" variant="outline" onClick={() => { setEnroll(null); setCode(''); setError(''); }}>Cancel</Button>
            </div>
          </form>
        )}

        {status.enabled && (
          <form onSubmit={disable} className="space-y-3 pt-2 border-t border-neutral-100">
            <h3 className="font-medium text-neutral-900">Disable</h3>
            <p className="text-sm text-neutral-600">Enter a current code from your app (or a recovery code) to turn two-factor authentication off.{status.requiredForAll && ' Not available while MFA is required for all admins.'}</p>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required disabled={status.requiredForAll} className={inputClass} placeholder="123456" />
            <div><Button type="submit" variant="danger" disabled={busy || status.requiredForAll}>{busy ? 'Working…' : 'Disable two-factor authentication'}</Button></div>
          </form>
        )}
      </div>
    </div>
  );
}
