// Shared cookie helpers for the MFA routes.
import { cookies } from 'next/headers';
import { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_TTL_SECONDS } from '@/lib/admin/mfa';

const secure = process.env.NODE_ENV === 'production';

export async function setChallengeCookie(token: string) {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', maxAge: MFA_CHALLENGE_TTL_SECONDS, path: '/' });
}

export async function clearChallengeCookie() {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', maxAge: 0, path: '/' });
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set('admin_session', token, { httpOnly: true, secure, sameSite: 'lax', maxAge: 8 * 60 * 60, path: '/' });
}
