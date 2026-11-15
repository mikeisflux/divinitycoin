// app/admin/login/page.tsx
// Admin login page: password, then — when the account is enrolled, or when
// MFA is required for all admins — a second step for the authenticator code
// or first-time enrolment.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'password' | 'code' | 'enroll' | 'recovery';

const inputClass =
  'w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden transition';
const buttonClass =
  'w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 disabled:cursor-not-allowed';

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enroll, setEnroll] = useState<{ qrDataUrl: string; secret: string; account: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const post = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const startEnrollment = async () => {
    const { ok, data } = await post('/api/admin/auth/mfa/setup');
    if (!ok) {
      setError(data.error || 'Could not start enrolment');
      if (data.restart) setStep('password');
      return;
    }
    setEnroll({ qrDataUrl: data.qrDataUrl, secret: data.secret, account: data.account });
    setStep('enroll');
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await post('/api/admin/auth/login', { email, password });
      if (!ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setPassword('');
      if (data.mfaRequired) {
        setStep('code');
      } else if (data.mfaEnrollmentRequired) {
        await startEnrollment();
      } else {
        router.push('/admin');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await post('/api/admin/auth/mfa/verify', { code });
      if (!ok) {
        setError(data.error || 'Invalid code');
        setCode('');
        if (data.restart) setStep('password');
        return;
      }
      router.push('/admin');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await post('/api/admin/auth/mfa/confirm', { code });
      if (!ok) {
        setError(data.error || 'Invalid code');
        setCode('');
        if (data.restart) setStep('password');
        return;
      }
      setRecoveryCodes(data.recoveryCodes || []);
      setStep('recovery');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">D</span>
              </div>
              <span className="text-2xl font-semibold text-neutral-900">
                Divinity<span className="text-primary-600">Coin</span>
              </span>
            </div>
            <h1 className="text-xl font-semibold text-neutral-900">
              {step === 'password' && 'Admin Login'}
              {step === 'code' && 'Two-factor code'}
              {step === 'enroll' && 'Set up two-factor authentication'}
              {step === 'recovery' && 'Save your recovery codes'}
            </h1>
            <p className="text-neutral-600 mt-1">
              {step === 'password' && 'Sign in to access the admin panel'}
              {step === 'code' && 'Enter the 6-digit code from your authenticator app, or a recovery code'}
              {step === 'enroll' && 'Two-factor authentication is required for all admin accounts'}
              {step === 'recovery' && 'Each code works once if you lose your phone. They will not be shown again.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
          )}

          {step === 'password' && (
            <form onSubmit={handlePassword} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">Email Address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="admin@example.com" autoComplete="username" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Signing in...' : 'Sign In'}</button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleCode} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-neutral-700 mb-2">Code</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} required className={`${inputClass} font-mono tracking-widest`} placeholder="123456" />
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Checking...' : 'Continue'}</button>
              <button type="button" onClick={() => { setStep('password'); setCode(''); setError(''); }} className="w-full text-sm text-neutral-500 hover:text-neutral-700">Start over</button>
            </form>
          )}

          {step === 'enroll' && enroll && (
            <form onSubmit={handleEnrollConfirm} className="space-y-6">
              <ol className="text-sm text-neutral-700 space-y-3 list-decimal pl-5">
                <li>Open an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator).</li>
                <li>
                  Scan this code:
                  <div className="mt-2 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={enroll.qrDataUrl} alt="Authenticator QR code" width={220} height={220} className="border border-neutral-200 rounded-lg" />
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">Can&apos;t scan? Enter this key manually for <span className="font-mono">{enroll.account}</span>:</p>
                  <p className="font-mono text-sm bg-neutral-100 rounded-sm px-2 py-1 mt-1 break-all select-all">{enroll.secret}</p>
                </li>
                <li>Enter the 6-digit code it shows:</li>
              </ol>
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required className={`${inputClass} font-mono tracking-widest`} placeholder="123456" />
              <button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Verifying...' : 'Turn on two-factor authentication'}</button>
            </form>
          )}

          {step === 'recovery' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((c) => (
                  <code key={c} className="font-mono text-sm bg-neutral-100 rounded-sm px-3 py-2 text-center select-all">{c}</code>
                ))}
              </div>
              <p className="text-sm text-neutral-600">Store these somewhere safe — a password manager, or printed. Each works once. If you lose your phone and these, an administrator with the SUPER_ADMIN role will have to reset your account.</p>
              <button type="button" onClick={() => router.push('/admin')} className={buttonClass}>I&apos;ve saved them — continue</button>
            </div>
          )}
        </div>

        <p className="text-center text-neutral-500 text-sm mt-6">Protected area. Unauthorized access is prohibited.</p>
      </div>
    </div>
  );
}
