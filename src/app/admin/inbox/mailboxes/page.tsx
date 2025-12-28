// app/admin/inbox/mailboxes/page.tsx
// Mailbox management page

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { MailboxesClient } from './MailboxesClient';
import Link from 'next/link';

async function getMailboxes() {
  const mailboxes = await prisma.mailbox.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          emails: true,
        },
      },
    },
  });

  return mailboxes.map((m) => ({
    ...m,
    emailCount: m._count.emails,
  }));
}

export default async function MailboxesPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const mailboxes = await getMailboxes();

  return (
    <AdminLayout
      title="Mailboxes"
      description="Manage email accounts"
      actions={
        <Link
          href="/admin/inbox"
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
        >
          ← Back to Inbox
        </Link>
      }
    >
      <MailboxesClient initialMailboxes={mailboxes} />
    </AdminLayout>
  );
}
