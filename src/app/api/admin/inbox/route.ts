// app/api/admin/inbox/route.ts
// Email inbox API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';
import crypto from 'crypto';

// GET - List emails with filtering
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const mailboxId = searchParams.get('mailboxId');
    const folder = searchParams.get('folder') || 'INBOX';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      isDeleted: folder === 'TRASH',
    };

    if (mailboxId) {
      where.mailboxId = mailboxId;
    }

    if (folder !== 'TRASH') {
      where.folder = folder;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { textBody: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          mailbox: {
            select: { id: true, email: true, name: true },
          },
          attachments: {
            select: { id: true, filename: true, contentType: true, size: true },
          },
        },
      }),
      prisma.email.count({ where }),
    ]);

    // Get folder counts
    const counts = await prisma.email.groupBy({
      by: ['folder'],
      where: {
        isDeleted: false,
        ...(mailboxId ? { mailboxId } : {}),
      },
      _count: true,
    });

    const unreadCount = await prisma.email.count({
      where: {
        isRead: false,
        isDeleted: false,
        folder: 'INBOX',
        ...(mailboxId ? { mailboxId } : {}),
      },
    });

    const trashCount = await prisma.email.count({
      where: {
        isDeleted: true,
        ...(mailboxId ? { mailboxId } : {}),
      },
    });

    const folderCounts: Record<string, number> = {
      TRASH: trashCount,
    };
    counts.forEach((c) => {
      folderCounts[c.folder] = c._count;
    });

    return NextResponse.json({
      emails,
      total,
      page,
      pages: Math.ceil(total / limit),
      folderCounts,
      unreadCount,
    });
  } catch (error) {
    logger.apiError('/api/admin/inbox', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

// POST - Send email or save draft
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { mailboxId, to, cc, bcc, subject, htmlBody, textBody, isDraft, replyToEmailId, sendToAllUsers } = body;

    if (!mailboxId) {
      return NextResponse.json({ error: 'Mailbox ID is required' }, { status: 400 });
    }

    const mailbox = await prisma.mailbox.findUnique({
      where: { id: mailboxId },
    });

    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    if (!isDraft && !to && !sendToAllUsers) {
      return NextResponse.json({ error: 'Recipient is required' }, { status: 400 });
    }

    // Handle sending to all registered users
    if (sendToAllUsers) {
      const users = await prisma.user.findMany({
        where: {
          email: { not: '' },
        },
        select: { email: true, name: true },
      });

      if (users.length === 0) {
        return NextResponse.json({ error: 'No users found to send to' }, { status: 400 });
      }

      // Add signature if available
      let finalHtml = htmlBody || '';
      if (mailbox.signature) {
        finalHtml += `<br><br>--<br>${mailbox.signature}`;
      }

      let successCount = 0;
      let failCount = 0;

      // Send to each user with rate limiting (1 email per second)
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          const result = await sendEmail({
            to: user.email,
            toName: user.name || undefined,
            subject: subject || '(no subject)',
            html: finalHtml,
            text: textBody,
            fromEmail: mailbox.email,
            fromName: mailbox.name,
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.error('Failed to send bulk email', { email: user.email, error: result.error });
          }
        } catch (sendError) {
          failCount++;
          logger.error('Error sending bulk email', { email: user.email, error: sendError });
        }

        // Rate limit: wait 1 second between emails (except for last one)
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Create a single record for the bulk send
      const messageId = `<${crypto.randomUUID()}@divinitycoin.com>`;
      await prisma.email.create({
        data: {
          mailboxId,
          direction: 'OUTBOUND',
          fromEmail: mailbox.email,
          fromName: mailbox.name,
          toEmail: `All Users (${users.length})`,
          subject: subject || '(no subject)',
          htmlBody: htmlBody || '',
          textBody: textBody || '',
          messageId,
          threadId: crypto.randomUUID(),
          folder: 'SENT',
          isRead: true,
          sentAt: new Date(),
        },
      });

      logger.info('Bulk email sent to all users', {
        totalUsers: users.length,
        successCount,
        failCount,
        subject,
      });

      return NextResponse.json({
        success: true,
        message: `Email sent to ${successCount} users${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        totalUsers: users.length,
        successCount,
        failCount,
      });
    }

    // Generate message ID
    const messageId = `<${crypto.randomUUID()}@divinitycoin.com>`;

    // Handle reply threading
    let threadId = crypto.randomUUID();
    let inReplyTo: string | null = null;

    if (replyToEmailId) {
      const replyToEmail = await prisma.email.findUnique({
        where: { id: replyToEmailId },
      });
      if (replyToEmail) {
        threadId = replyToEmail.threadId || threadId;
        inReplyTo = replyToEmail.messageId;
      }
    }

    // Create email record
    const email = await prisma.email.create({
      data: {
        mailboxId,
        direction: 'OUTBOUND',
        fromEmail: mailbox.email,
        fromName: mailbox.name,
        toEmail: to || '',
        ccEmails: cc ? cc.split(',').map((e: string) => e.trim()) : [],
        bccEmails: bcc ? bcc.split(',').map((e: string) => e.trim()) : [],
        subject: subject || '(no subject)',
        htmlBody: htmlBody || '',
        textBody: textBody || '',
        messageId,
        threadId,
        inReplyTo,
        isDraft: isDraft || false,
        folder: isDraft ? 'DRAFTS' : 'SENT',
        isRead: true,
      },
    });

    // If not a draft, send the email
    if (!isDraft && to) {
      try {
        // Add signature if available
        let finalHtml = htmlBody || '';
        if (mailbox.signature) {
          finalHtml += `<br><br>--<br>${mailbox.signature}`;
        }

        const result = await sendEmail({
          to,
          toName: undefined,
          subject: subject || '(no subject)',
          html: finalHtml,
          text: textBody,
          fromEmail: mailbox.email,
          fromName: mailbox.name,
        });

        if (result.success) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              sendgridMessageId: result.messageId,
              sentAt: new Date(),
            },
          });
        } else {
          logger.error('Failed to send email', { emailId: email.id, error: result.error });
        }
      } catch (sendError) {
        logger.error('Error sending email', { emailId: email.id, error: sendError });
      }
    }

    logger.info(isDraft ? 'Draft saved' : 'Email sent', {
      emailId: email.id,
      to,
      subject,
    });

    return NextResponse.json({ email });
  } catch (error) {
    logger.apiError('/api/admin/inbox POST', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
