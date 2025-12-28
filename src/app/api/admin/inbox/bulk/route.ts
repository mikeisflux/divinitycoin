// app/api/admin/inbox/bulk/route.ts
// Bulk email operations API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

// POST - Bulk operations on emails
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { emailIds, action, value } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json({ error: 'Email IDs are required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'markAsRead':
        updateData = { isRead: true, readAt: new Date() };
        break;
      case 'markAsUnread':
        updateData = { isRead: false };
        break;
      case 'star':
        updateData = { isStarred: true };
        break;
      case 'unstar':
        updateData = { isStarred: false };
        break;
      case 'archive':
        updateData = { isArchived: true, folder: 'ARCHIVE' };
        break;
      case 'unarchive':
        updateData = { isArchived: false, folder: 'INBOX' };
        break;
      case 'spam':
        updateData = { isSpam: true, folder: 'SPAM' };
        break;
      case 'notSpam':
        updateData = { isSpam: false, folder: 'INBOX' };
        break;
      case 'trash':
        updateData = { isDeleted: true, folder: 'TRASH' };
        break;
      case 'restore':
        updateData = { isDeleted: false, folder: 'INBOX' };
        break;
      case 'moveToFolder':
        if (!value) {
          return NextResponse.json({ error: 'Folder value is required' }, { status: 400 });
        }
        updateData = { folder: value };
        break;
      case 'addLabel':
        // This requires a different approach - need to append to array
        const emailsForLabel = await prisma.email.findMany({
          where: { id: { in: emailIds } },
          select: { id: true, labels: true },
        });

        await Promise.all(
          emailsForLabel.map((email) =>
            prisma.email.update({
              where: { id: email.id },
              data: {
                labels: [...new Set([...email.labels, value])],
              },
            })
          )
        );

        logger.info('Bulk label added', { emailCount: emailIds.length, label: value });
        return NextResponse.json({ success: true, updated: emailIds.length });

      case 'removeLabel':
        const emailsToRemoveLabel = await prisma.email.findMany({
          where: { id: { in: emailIds } },
          select: { id: true, labels: true },
        });

        await Promise.all(
          emailsToRemoveLabel.map((email) =>
            prisma.email.update({
              where: { id: email.id },
              data: {
                labels: email.labels.filter((l) => l !== value),
              },
            })
          )
        );

        logger.info('Bulk label removed', { emailCount: emailIds.length, label: value });
        return NextResponse.json({ success: true, updated: emailIds.length });

      case 'permanentDelete':
        await prisma.email.deleteMany({
          where: { id: { in: emailIds } },
        });
        logger.info('Bulk permanent delete', { emailCount: emailIds.length });
        return NextResponse.json({ success: true, deleted: emailIds.length });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await prisma.email.updateMany({
      where: { id: { in: emailIds } },
      data: updateData,
    });

    logger.info('Bulk email action', { action, emailCount: result.count });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    logger.apiError('/api/admin/inbox/bulk', error);
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 });
  }
}
