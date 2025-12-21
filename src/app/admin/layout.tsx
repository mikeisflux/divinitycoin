// app/admin/layout.tsx
// Admin panel layout - wraps admin pages (no html/body tags - those are in root layout)

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
  // The root layout handles html/body
  // This layout just provides admin-specific styling
  return (
    <div className="bg-neutral-100 min-h-screen">
      {children}
    </div>
  );
}
