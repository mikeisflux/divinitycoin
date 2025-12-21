// app/admin/admins/[id]/page.tsx
// Edit admin user page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest, canManageAdmins } from '@/lib/admin/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { EditAdminForm } from './EditAdminForm';

async function getAdmin(id: string) {
  return prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });
}

export default async function EditAdminPage({ params }: { params: { id: string } }) {
  const currentAdmin = await getAdminFromRequest();

  if (!currentAdmin) {
    redirect('/admin/login');
  }

  if (!canManageAdmins(currentAdmin.role)) {
    redirect('/admin');
  }

  const admin = await getAdmin(params.id);

  if (!admin) {
    notFound();
  }

  // Prevent editing super admins unless you are a super admin
  const canEdit = currentAdmin.role === 'SUPER_ADMIN' || admin.role !== 'SUPER_ADMIN';

  return (
    <AdminLayout
      title={`Edit Admin: ${admin.name}`}
      description="Modify administrator account settings"
    >
      <div className="mb-6">
        <Link href="/admin/admins" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Admins
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <EditAdminForm admin={admin} canEdit={canEdit} currentAdminId={currentAdmin.id} />
        </div>

        {/* Admin Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Account Info</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Created</dt>
                <dd className="font-medium text-neutral-900">
                  {new Date(admin.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Last Login</dt>
                <dd className="font-medium text-neutral-900">
                  {admin.lastLoginAt
                    ? new Date(admin.lastLoginAt).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Failed Login Attempts</dt>
                <dd className="font-medium text-neutral-900">{admin.failedLoginAttempts}</dd>
              </div>
              {admin.lockedUntil && new Date(admin.lockedUntil) > new Date() && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <dt className="text-red-700 font-medium">Account Locked Until</dt>
                  <dd className="text-red-600">
                    {new Date(admin.lockedUntil).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Security</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">MFA Status</span>
                {admin.mfaEnabled ? (
                  <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Enabled
                  </span>
                ) : (
                  <span className="text-amber-600 text-sm font-medium">Not Enabled</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
