// app/api/admin/inbox/migrate/route.ts
// Migrate old EmailLog entries to new Email table

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    // First, ensure we have a default mailbox
    let defaultMailbox = await prisma.mailbox.findFirst({
      where: { isDefault: true },
    });

    if (!defaultMailbox) {
      // Create a default mailbox
      defaultMailbox = await prisma.mailbox.create({
        data: {
          email: 'inbox@divinitycoin.com',
          name: 'Main Inbox',
          isDefault: true,
          isActive: true,
        },
      });
      logger.info('Created default mailbox', { mailboxId: defaultMailbox.id });
    }

    // Get all EmailLog entries that haven't been migrated
    const emailLogs = await prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (emailLogs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to migrate',
        migrated: 0,
      });
    }

    let migrated = 0;
    let skipped = 0;

    for (const log of emailLogs) {
      try {
        // Check if already migrated (by sendgridMessageId)
        if (log.sendgridMessageId) {
          const existing = await prisma.email.findFirst({
            where: { sendgridMessageId: log.sendgridMessageId },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        // Determine direction based on from/to
        const isOutbound = log.fromEmail.includes('divinitycoin.com');

        // Find or create mailbox for this email
        let mailbox = defaultMailbox;
        const relevantEmail = isOutbound ? log.fromEmail : log.toEmail;

        if (relevantEmail.includes('divinitycoin.com')) {
          const existingMailbox = await prisma.mailbox.findUnique({
            where: { email: relevantEmail.toLowerCase() },
          });
          if (existingMailbox) {
            mailbox = existingMailbox;
          }
        }

        // Create the email record
        await prisma.email.create({
          data: {
            mailboxId: mailbox.id,
            direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
            fromEmail: log.fromEmail,
            fromName: log.fromName || null,
            toEmail: log.toEmail,
            toName: log.toName || null,
            subject: log.subject,
            textBody: log.textContent || null,
            htmlBody: log.htmlContent || null,
            isRead: true, // Mark all migrated emails as read
            folder: isOutbound ? 'SENT' : 'INBOX',
            sendgridMessageId: log.sendgridMessageId || null,
            receivedAt: log.sentAt || log.createdAt,
            sentAt: isOutbound ? (log.sentAt || log.createdAt) : null,
          },
        });

        migrated++;
      } catch (error) {
        logger.error('Failed to migrate email', { emailLogId: log.id, error });
      }
    }

    logger.info('Email migration completed', { migrated, skipped, total: emailLogs.length });

    return NextResponse.json({
      success: true,
      message: `Migrated ${migrated} emails`,
      migrated,
      skipped,
      total: emailLogs.length,
    });
  } catch (error) {
    logger.apiError('/api/admin/inbox/migrate', error);
    return NextResponse.json({ error: 'Failed to migrate emails' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const [emailLogCount, emailCount, mailboxCount] = await Promise.all([
      prisma.emailLog.count(),
      prisma.email.count(),
      prisma.mailbox.count(),
    ]);

    return NextResponse.json({
      emailLogCount,
      emailCount,
      mailboxCount,
      needsMigration: emailLogCount > 0 && emailCount === 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check migration status' }, { status: 500 });
  }
}
