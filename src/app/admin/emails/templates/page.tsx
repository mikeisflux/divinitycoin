// app/admin/emails/templates/page.tsx
// Email template management

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

async function getTemplates() {
  return prisma.emailTemplate.findMany({
    orderBy: { name: 'asc' },
    include: {
      versions: {
        where: { isActive: true },
        take: 1,
      },
      _count: {
        select: { versions: true },
      },
    },
  });
}

export default async function EmailTemplatesPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const templates = await getTemplates();

  return (
    <AdminLayout
      title="Email Templates"
      description="Manage email templates"
      actions={
        <Link
          href="/admin/emails/templates/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      }
    >
      <div className="mb-6">
        <Link href="/admin/emails" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Email Dashboard
        </Link>
      </div>

      {/* Template Categories */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900">Transactional</h3>
          <p className="text-sm text-blue-700 mt-1">Purchase confirmations, receipts, password resets</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h3 className="font-semibold text-green-900">Marketing</h3>
          <p className="text-sm text-green-700 mt-1">Promotional emails, reminders, newsletters</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
          <h3 className="font-semibold text-purple-900">Admin</h3>
          <p className="text-sm text-purple-700 mt-1">System alerts, notifications, reports</p>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Template</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Versions</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                  No templates created yet. Run <code className="bg-neutral-100 px-2 py-1 rounded">npm run db:seed</code> to create default templates.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-neutral-900">{template.name}</div>
                      <div className="text-sm text-neutral-500">{template.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      template.category === 'transactional' ? 'bg-blue-100 text-blue-800' :
                      template.category === 'marketing' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {template.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate">
                    {template.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {template.isActive ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Active
                      </span>
                    ) : (
                      <span className="text-neutral-500 text-sm">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {template._count.versions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/emails/templates/${template.id}`} className="text-primary-600 hover:text-primary-900">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Variable Reference */}
      <div className="mt-8 bg-neutral-50 rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Template Variables</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Use these variables in your templates. They will be replaced with actual values when the email is sent.
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-neutral-700 mb-2">Gift Card Emails</h4>
            <ul className="space-y-1 text-neutral-600">
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{code}}`}</code> - Gift card code</li>
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{amount}}`}</code> - Gift card amount</li>
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{expiryDate}}`}</code> - Expiration date</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-neutral-700 mb-2">User Emails</h4>
            <ul className="space-y-1 text-neutral-600">
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{userName}}`}</code> - User's name</li>
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{email}}`}</code> - User's email</li>
              <li><code className="bg-white px-1.5 py-0.5 rounded border">{`{{resetLink}}`}</code> - Password reset link</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
