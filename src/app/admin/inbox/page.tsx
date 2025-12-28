// app/admin/inbox/page.tsx
// Gmail-style email inbox

import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminFromRequest } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { InboxClient } from './InboxClient';

async function getMailboxesAndEmails() {
  // Check if we need to show migration prompt
  const [emailLogCount, emailCount] = await Promise.all([
    prisma.emailLog.count(),
    prisma.email.count(),
  ]);

  const needsMigration = emailLogCount > 0 && emailCount === 0;

  const [mailboxes, emails, folderCounts] = await Promise.all([
    prisma.mailbox.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            emails: {
              where: { isDeleted: false, isRead: false, folder: 'INBOX' },
            },
          },
        },
      },
    }),
    prisma.email.findMany({
      where: { isDeleted: false, folder: 'INBOX' },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      include: {
        mailbox: {
          select: { id: true, email: true, name: true },
        },
        attachments: {
          select: { id: true, filename: true },
        },
      },
    }),
    prisma.email.groupBy({
      by: ['folder'],
      where: { isDeleted: false },
      _count: true,
    }),
  ]);

  const trashCount = await prisma.email.count({
    where: { isDeleted: true },
  });

  const counts: Record<string, number> = { TRASH: trashCount };
  folderCounts.forEach((f) => {
    counts[f.folder] = f._count;
  });

  return {
    mailboxes: mailboxes.map((m) => ({
      ...m,
      unreadCount: m._count.emails,
    })),
    emails,
    folderCounts: counts,
    needsMigration,
    oldEmailCount: emailLogCount,
  };
}

export default async function InboxPage() {
  const admin = await getAdminFromRequest();

  if (!admin) {
    redirect('/admin/login');
  }

  const { mailboxes, emails, folderCounts, needsMigration, oldEmailCount } = await getMailboxesAndEmails();

  return (
    <AdminLayout
      title="Inbox"
      description="Email management"
    >
      <InboxClient
        initialMailboxes={mailboxes}
        initialEmails={emails}
        initialFolderCounts={folderCounts}
        needsMigration={needsMigration}
        oldEmailCount={oldEmailCount}
      />
    </AdminLayout>
  );
}
