// app/layout.tsx

import { headers } from 'next/headers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata = {
  title: 'DivinityCoin - Support Creators Seamlessly',
  description:
    'Purchase credits to support your favorite creators across partner platforms.',
  keywords: ['divinity', 'coin', 'credits', 'support', 'crowdfunding', 'gift card'],
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if we're on an admin or partner dashboard route
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
  const isAdminRoute = pathname.startsWith('/admin');
  const isPartnerDashboardRoute = pathname.startsWith('/partners/') && !pathname.startsWith('/partners/login');

  const hideHeaderFooter = isAdminRoute || isPartnerDashboardRoute;

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-neutral-900 antialiased font-sans">
        {!hideHeaderFooter && <Header />}
        <main className="flex-1">{children}</main>
        {!hideHeaderFooter && <Footer />}
      </body>
    </html>
  );
}
