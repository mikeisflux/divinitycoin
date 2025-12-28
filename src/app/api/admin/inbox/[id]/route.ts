// app/api/admin/inbox/[id]/route.ts
// Individual email API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

// GET - Get single email
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const email = await prisma.email.findUnique({
      where: { id: params.id },
      include: {
        mailbox: {
          select: { id: true, email: true, name: true },
        },
        attachments: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Mark as read if viewing
    if (!email.isRead) {
      await prisma.email.update({
        where: { id: params.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    // Get thread emails if part of a thread
    let thread: typeof email[] = [];
    if (email.threadId) {
      thread = await prisma.email.findMany({
        where: {
          threadId: email.threadId,
          id: { not: email.id },
          isDeleted: false,
        },
        orderBy: { receivedAt: 'asc' },
        include: {
          mailbox: {
            select: { id: true, email: true, name: true },
          },
          attachments: true,
        },
      });
    }

    return NextResponse.json({
      email: { ...email, isRead: true },
      thread,
    });
  } catch (error) {
    logger.apiError('/api/admin/inbox/[id]', error);
    return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 });
  }
}

// PUT - Update email (mark as read, star, move to folder, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { isRead, isStarred, folder, labels, isArchived, isSpam } = body;

    const email = await prisma.email.findUnique({
      where: { id: params.id },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (isRead !== undefined) {
      updateData.isRead = isRead;
      if (isRead && !email.readAt) {
        updateData.readAt = new Date();
      }
    }

    if (isStarred !== undefined) {
      updateData.isStarred = isStarred;
    }

    if (folder !== undefined) {
      updateData.folder = folder;
      if (folder === 'ARCHIVE') {
        updateData.isArchived = true;
      }
      if (folder === 'SPAM') {
        updateData.isSpam = true;
      }
    }

    if (labels !== undefined) {
      updateData.labels = labels;
    }

    if (isArchived !== undefined) {
      updateData.isArchived = isArchived;
      if (isArchived) {
        updateData.folder = 'ARCHIVE';
      }
    }

    if (isSpam !== undefined) {
      updateData.isSpam = isSpam;
      if (isSpam) {
        updateData.folder = 'SPAM';
      }
    }

    const updatedEmail = await prisma.email.update({
      where: { id: params.id },
      data: updateData,
      include: {
        mailbox: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return NextResponse.json({ email: updatedEmail });
  } catch (error) {
    logger.apiError('/api/admin/inbox/[id] PUT', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}

// DELETE - Move to trash or permanently delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const email = await prisma.email.findUnique({
      where: { id: params.id },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (permanent || email.isDeleted) {
      // Permanently delete
      await prisma.email.delete({
        where: { id: params.id },
      });
      logger.info('Email permanently deleted', { emailId: params.id });
    } else {
      // Move to trash
      await prisma.email.update({
        where: { id: params.id },
        data: {
          isDeleted: true,
          folder: 'TRASH',
        },
      });
      logger.info('Email moved to trash', { emailId: params.id });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('/api/admin/inbox/[id] DELETE', error);
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 });
  }
}
