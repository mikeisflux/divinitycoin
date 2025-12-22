// app/partner/login/page.tsx
// Redirect to the canonical partner login URL

import { redirect } from 'next/navigation';

export default function PartnerLoginRedirect() {
  redirect('/partners/login');
}
