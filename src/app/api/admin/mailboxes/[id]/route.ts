// app/api/admin/mailboxes/[id]/route.ts
// Individual mailbox management API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

// GET - Get single mailbox
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            emails: { where: { isDeleted: false } },
          },
        },
      },
    });

    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    const unreadCount = await prisma.email.count({
      where: {
        mailboxId: mailbox.id,
        isRead: false,
        isDeleted: false,
        folder: 'INBOX',
      },
    });

    return NextResponse.json({
      mailbox: {
        ...mailbox,
        totalEmails: mailbox._count.emails,
        unreadCount,
      },
    });
  } catch (error) {
    logger.apiError('/api/admin/mailboxes/[id]', error);
    return NextResponse.json({ error: 'Failed to fetch mailbox' }, { status: 500 });
  }
}

// PUT - Update mailbox
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { name, isActive, isDefault, signature, autoReplyEnabled, autoReplySubject, autoReplyMessage } = body;

    const existing = await prisma.mailbox.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.mailbox.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const mailbox = await prisma.mailbox.update({
      where: { id: params.id },
      data: {
        name: name !== undefined ? name : existing.name,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
        signature: signature !== undefined ? signature : existing.signature,
        autoReplyEnabled: autoReplyEnabled !== undefined ? autoReplyEnabled : existing.autoReplyEnabled,
        autoReplySubject: autoReplySubject !== undefined ? autoReplySubject : existing.autoReplySubject,
        autoReplyMessage: autoReplyMessage !== undefined ? autoReplyMessage : existing.autoReplyMessage,
      },
    });

    logger.info('Mailbox updated', { mailboxId: mailbox.id });

    return NextResponse.json({ mailbox });
  } catch (error) {
    logger.apiError('/api/admin/mailboxes/[id] PUT', error);
    return NextResponse.json({ error: 'Failed to update mailbox' }, { status: 500 });
  }
}

// DELETE - Delete mailbox
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { emails: true },
        },
      },
    });

    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    if (mailbox._count.emails > 0) {
      return NextResponse.json({
        error: 'Cannot delete mailbox with emails. Delete or move emails first.',
      }, { status: 400 });
    }

    await prisma.mailbox.delete({
      where: { id: params.id },
    });

    logger.info('Mailbox deleted', { mailboxId: params.id, email: mailbox.email });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('/api/admin/mailboxes/[id] DELETE', error);
    return NextResponse.json({ error: 'Failed to delete mailbox' }, { status: 500 });
  }
}
