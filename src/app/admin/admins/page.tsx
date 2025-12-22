// app/admin/admins/page.tsx
// Admin user management page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest, canManageAdmins } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

async function getAdmins(): Promise<AdminUser[]> {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    ADMIN: 'bg-blue-100 text-blue-800',
    FINANCE: 'bg-green-100 text-green-800',
    SUPPORT: 'bg-yellow-100 text-yellow-800',
    VIEWER: 'bg-neutral-100 text-neutral-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role] || 'bg-neutral-100 text-neutral-800'}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

export default async function AdminsPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  if (!canManageAdmins(admin.role)) {
    redirect('/admin');
  }

  const admins = await getAdmins();

  return (
    <AdminLayout
      title="Admin Users"
      description="Manage administrator accounts"
      actions={
        <Link
          href="/admin/admins/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Admin
        </Link>
      }
    >
      {/* Role Permissions */}
      <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6 mb-8">
        <h3 className="font-semibold text-neutral-900 mb-4">Role Permissions</h3>
        <div className="grid md:grid-cols-5 gap-4 text-sm">
          <div>
            <RoleBadge role="SUPER_ADMIN" />
            <p className="text-neutral-600 mt-2">Full access to all features</p>
          </div>
          <div>
            <RoleBadge role="ADMIN" />
            <p className="text-neutral-600 mt-2">Manage settings, partners, gift cards</p>
          </div>
          <div>
            <RoleBadge role="FINANCE" />
            <p className="text-neutral-600 mt-2">View financials, process refunds</p>
          </div>
          <div>
            <RoleBadge role="SUPPORT" />
            <p className="text-neutral-600 mt-2">Manage users, gift cards, support</p>
          </div>
          <div>
            <RoleBadge role="VIEWER" />
            <p className="text-neutral-600 mt-2">Read-only access to dashboard</p>
          </div>
        </div>
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">MFA</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Created</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {admins.map((adminUser) => (
              <tr key={adminUser.id} className="hover:bg-neutral-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{adminUser.name}</div>
                    <div className="text-sm text-neutral-500">{adminUser.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RoleBadge role={adminUser.role} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {adminUser.mfaEnabled ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Enabled
                    </span>
                  ) : (
                    <span className="text-neutral-500">Disabled</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                  {adminUser.lastLoginAt ? new Date(adminUser.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                  {new Date(adminUser.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/admin/admins/${adminUser.id}`} className="text-primary-600 hover:text-primary-900">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
