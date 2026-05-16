// app/partners/layout.tsx
// Partner portal layout

import '../globals.css';
import { getImpersonationFromRequest } from '@/lib/partner/auth';

export const metadata = {
  title: 'Partner Portal - DivinityCoin',
  description: 'DivinityCoin Partner Dashboard',
  robots: 'noindex, nofollow',
};

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const impersonation = await getImpersonationFromRequest();

  return (
    <html lang="en">
      <body className="font-sans bg-neutral-100 min-h-screen">
        {impersonation && (
          <div className="bg-amber-500 text-white text-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>
                  Viewing as <strong>{impersonation.user.partnerName}</strong> — admin impersonation, the partner&apos;s own session is preserved
                </span>
              </div>
              <form action="/api/admin/partners/impersonate/stop" method="POST">
                <button
                  type="submit"
                  className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded font-medium transition"
                >
                  Exit
                </button>
              </form>
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
