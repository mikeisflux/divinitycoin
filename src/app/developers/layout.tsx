// app/developers/layout.tsx
// Gates the developer / API documentation behind partner login —
// or admin login, since platform staff need to read the docs too
// without having to maintain a separate partner account.

import { getPartnerFromRequest } from '@/lib/partner/auth';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  robots: 'noindex, nofollow',
};

export default async function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [partner, admin] = await Promise.all([
    getPartnerFromRequest(),
    getAdminFromRequest(),
  ]);

  if (!partner && !admin) {
    redirect('/partners/login?redirect=/developers');
  }

  return <>{children}</>;
}
