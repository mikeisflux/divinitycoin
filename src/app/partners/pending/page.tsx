// app/partners/pending/page.tsx
// Partner account pending approval page

import { getPartnerFromRequest } from '@/lib/partner/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PartnerPendingPage() {
  const partner = await getPartnerFromRequest();

  if (!partner) {
    redirect('/partners/login');
  }

  if (partner.partnerStatus === 'ACTIVE') {
    redirect('/partners/dashboard');
  }

  const statusMessages: Record<string, { title: string; message: string; color: string }> = {
    PENDING: {
      title: 'Application Under Review',
      message: 'Your partner application is being reviewed by our team. We typically process applications within 2-3 business days.',
      color: 'yellow',
    },
    SUSPENDED: {
      title: 'Account Suspended',
      message: 'Your partner account has been temporarily suspended. Please contact support for more information.',
      color: 'red',
    },
    DEACTIVATED: {
      title: 'Account Deactivated',
      message: 'Your partner account has been deactivated. If you believe this is an error, please contact support.',
      color: 'red',
    },
  };

  const status = statusMessages[partner.partnerStatus] || statusMessages.PENDING;

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className={`w-16 h-16 bg-${status.color}-100 rounded-full flex items-center justify-center mx-auto mb-6`}>
          {partner.partnerStatus === 'PENDING' ? (
            <svg className={`w-8 h-8 text-${status.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className={`w-8 h-8 text-${status.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">{status.title}</h1>
        <p className="text-neutral-600 mb-6">{status.message}</p>

        <div className="bg-neutral-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-neutral-500 mb-1">Partner Organization</p>
          <p className="font-medium text-neutral-900">{partner.partnerName}</p>
          <p className="text-sm text-neutral-500 mt-3 mb-1">Contact Email</p>
          <p className="text-neutral-700">{partner.email}</p>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:partners@divinitycoin.com"
            className="block w-full py-2 px-4 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition"
          >
            Contact Support
          </a>
          <form action="/api/partners/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full py-2 px-4 text-sm text-neutral-600 hover:text-neutral-900"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
