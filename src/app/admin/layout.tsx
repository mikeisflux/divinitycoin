// app/admin/layout.tsx
// Admin panel layout

import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Admin - DivinityCoin',
  description: 'DivinityCoin Administration Panel',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({
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
