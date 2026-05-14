// app/developers/layout.tsx
// Gates the developer / API documentation behind partner login.

import { getPartnerFromRequest } from '@/lib/partner/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  robots: 'noindex, nofollow',
};

export default async function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartnerFromRequest();

  if (!partner) {
    redirect('/partners/login?redirect=/developers');
  }

  return <>{children}</>;
}
