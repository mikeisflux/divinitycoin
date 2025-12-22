// app/partners/layout.tsx
// Partner portal layout

import '../globals.css';

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
      <body className="font-sans bg-neutral-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
