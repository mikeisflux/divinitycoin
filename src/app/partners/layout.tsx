// app/partners/layout.tsx
// Partner portal layout

import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Partner Portal - DivinityCoin',
  description: 'DivinityCoin Partner Dashboard',
  robots: 'noindex, nofollow',
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
