// app/api/admin/mailboxes/route.ts
// Mailbox management API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

// GET - List all mailboxes
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const mailboxes = await prisma.mailbox.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            emails: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    // Get unread counts for each mailbox
    const mailboxesWithCounts = await Promise.all(
      mailboxes.map(async (mailbox) => {
        const unreadCount = await prisma.email.count({
          where: {
            mailboxId: mailbox.id,
            isRead: false,
            isDeleted: false,
            folder: 'INBOX',
          },
        });
        return {
          ...mailbox,
          totalEmails: mailbox._count.emails,
          unreadCount,
        };
      })
    );

    return NextResponse.json({ mailboxes: mailboxesWithCounts });
  } catch (error) {
    logger.apiError('/api/admin/mailboxes', error);
    return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 });
  }
}

// POST - Create new mailbox
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { email, name, isDefault, signature, autoReplyEnabled, autoReplySubject, autoReplyMessage } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.mailbox.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Mailbox with this email already exists' }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.mailbox.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const mailbox = await prisma.mailbox.create({
      data: {
        email: email.toLowerCase(),
        name,
        isDefault: isDefault || false,
        signature,
        autoReplyEnabled: autoReplyEnabled || false,
        autoReplySubject,
        autoReplyMessage,
      },
    });

    logger.info('Mailbox created', { mailboxId: mailbox.id, email: mailbox.email });

    return NextResponse.json({ mailbox });
  } catch (error) {
    logger.apiError('/api/admin/mailboxes POST', error);
    return NextResponse.json({ error: 'Failed to create mailbox' }, { status: 500 });
  }
}
