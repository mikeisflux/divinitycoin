// lib/email/queue.ts
// Email queue system for rate-limited sending

import { prisma } from '@/lib/db';
import { sendEmail } from './sendgrid';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface QueueEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  mailboxId?: string;
  priority?: number;
  scheduledAt?: Date;
  bulkSendId?: string;
  bulkSendIndex?: number;
}

/**
 * Add a single email to the queue
 */
export async function queueEmail(params: QueueEmailParams) {
  return prisma.emailQueue.create({
    data: {
      toEmail: params.to,
      toName: params.toName,
      subject: params.subject,
      htmlBody: params.html,
      textBody: params.text,
      fromEmail: params.fromEmail,
      fromName: params.fromName,
      mailboxId: params.mailboxId,
      priority: params.priority ?? 10,
      scheduledAt: params.scheduledAt,
      bulkSendId: params.bulkSendId,
      bulkSendIndex: params.bulkSendIndex,
    },
  });
}

/**
 * Add multiple emails to the queue (bulk send)
 */
export async function queueBulkEmails(
  emails: Array<{ to: string; toName?: string }>,
  content: {
    subject: string;
    html: string;
    text?: string;
    fromEmail?: string;
    fromName?: string;
    mailboxId?: string;
  }
) {
  const bulkSendId = crypto.randomUUID();

  const queueEntries = emails.map((email, index) => ({
    toEmail: email.to,
    toName: email.toName,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    fromEmail: content.fromEmail,
    fromName: content.fromName,
    mailboxId: content.mailboxId,
    priority: 20, // Lower priority for bulk sends
    bulkSendId,
    bulkSendIndex: index,
  }));

  await prisma.emailQueue.createMany({
    data: queueEntries,
  });

  logger.info('Bulk emails queued', {
    bulkSendId,
    count: emails.length,
    subject: content.subject,
  });

  return {
    bulkSendId,
    count: emails.length,
  };
}

/**
 * Process pending emails from the queue
 * Should be called by a cron job or worker
 * Processes one email per second to respect rate limits
 */
export async function processEmailQueue(maxEmails: number = 60) {
  const stats = {
    processed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
  };

  // Get pending emails, prioritized
  const now = new Date();
  const pendingEmails = await prisma.emailQueue.findMany({
    where: {
      status: 'PENDING',
      AND: [
        {
          OR: [
            { scheduledAt: null },
            { scheduledAt: { lte: now } },
          ],
        },
        {
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: now } },
          ],
        },
      ],
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
    take: maxEmails,
  });

  if (pendingEmails.length === 0) {
    return stats;
  }

  logger.info('Processing email queue', { count: pendingEmails.length });

  for (const queuedEmail of pendingEmails) {
    stats.processed++;

    // Mark as processing
    await prisma.emailQueue.update({
      where: { id: queuedEmail.id },
      data: { status: 'PROCESSING' },
    });

    try {
      const result = await sendEmail({
        to: queuedEmail.toEmail,
        toName: queuedEmail.toName || undefined,
        subject: queuedEmail.subject,
        html: queuedEmail.htmlBody,
        text: queuedEmail.textBody || undefined,
        fromEmail: queuedEmail.fromEmail || undefined,
        fromName: queuedEmail.fromName || undefined,
      });

      if (result.success) {
        // Mark as sent
        await prisma.emailQueue.update({
          where: { id: queuedEmail.id },
          data: {
            status: 'SENT',
            sendgridMessageId: result.messageId,
            sentAt: new Date(),
            processedAt: new Date(),
          },
        });
        stats.sent++;
      } else {
        // Handle failure
        const attempts = queuedEmail.attempts + 1;

        if (attempts >= queuedEmail.maxAttempts) {
          // Max retries reached, mark as failed
          await prisma.emailQueue.update({
            where: { id: queuedEmail.id },
            data: {
              status: 'FAILED',
              attempts,
              lastError: result.error,
              processedAt: new Date(),
            },
          });
          stats.failed++;
        } else {
          // Schedule retry with exponential backoff
          const backoffSeconds = Math.pow(2, attempts) * 60; // 2min, 4min, 8min...
          const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

          await prisma.emailQueue.update({
            where: { id: queuedEmail.id },
            data: {
              status: 'PENDING',
              attempts,
              lastError: result.error,
              nextRetryAt,
            },
          });
          stats.retried++;
        }

        logger.error('Failed to send queued email', {
          queueId: queuedEmail.id,
          error: result.error,
          attempts,
        });
      }
    } catch (error) {
      // Unexpected error - retry
      const attempts = queuedEmail.attempts + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.emailQueue.update({
        where: { id: queuedEmail.id },
        data: {
          status: attempts >= queuedEmail.maxAttempts ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errorMessage,
          nextRetryAt: attempts < queuedEmail.maxAttempts
            ? new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000)
            : null,
        },
      });

      if (attempts >= queuedEmail.maxAttempts) {
        stats.failed++;
      } else {
        stats.retried++;
      }

      logger.error('Exception while sending queued email', {
        queueId: queuedEmail.id,
        error: errorMessage,
      });
    }

    // Rate limit: wait 1 second between emails
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info('Email queue processing complete', stats);

  return stats;
}

/**
 * Get queue status and statistics
 */
export async function getQueueStats() {
  const [
    pending,
    processing,
    sent,
    failed,
    recentBulkSends,
  ] = await Promise.all([
    prisma.emailQueue.count({ where: { status: 'PENDING' } }),
    prisma.emailQueue.count({ where: { status: 'PROCESSING' } }),
    prisma.emailQueue.count({ where: { status: 'SENT' } }),
    prisma.emailQueue.count({ where: { status: 'FAILED' } }),
    prisma.emailQueue.groupBy({
      by: ['bulkSendId'],
      where: {
        bulkSendId: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _count: true,
      _max: { sentAt: true },
    }),
  ]);

  // Calculate estimated time to process pending emails (1 per second)
  const estimatedSecondsRemaining = pending + processing;
  const estimatedMinutesRemaining = Math.ceil(estimatedSecondsRemaining / 60);

  return {
    pending,
    processing,
    sent,
    failed,
    total: pending + processing + sent + failed,
    estimatedMinutesRemaining,
    recentBulkSends: recentBulkSends.length,
  };
}

/**
 * Get bulk send status
 */
export async function getBulkSendStatus(bulkSendId: string) {
  const emails = await prisma.emailQueue.findMany({
    where: { bulkSendId },
    select: {
      status: true,
      sentAt: true,
      lastError: true,
    },
  });

  const stats = {
    total: emails.length,
    pending: emails.filter(e => e.status === 'PENDING').length,
    processing: emails.filter(e => e.status === 'PROCESSING').length,
    sent: emails.filter(e => e.status === 'SENT').length,
    failed: emails.filter(e => e.status === 'FAILED').length,
  };

  return {
    ...stats,
    isComplete: stats.pending === 0 && stats.processing === 0,
    successRate: stats.total > 0 ? (stats.sent / stats.total) * 100 : 0,
  };
}

/**
 * Cancel pending emails (e.g., for a bulk send)
 */
export async function cancelPendingEmails(bulkSendId?: string) {
  const where = bulkSendId
    ? { bulkSendId, status: 'PENDING' as const }
    : { status: 'PENDING' as const };

  const result = await prisma.emailQueue.updateMany({
    where,
    data: { status: 'CANCELLED' },
  });

  return result.count;
}

/**
 * Clear old completed/failed emails from queue
 */
export async function cleanupQueue(daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await prisma.emailQueue.deleteMany({
    where: {
      status: { in: ['SENT', 'FAILED', 'CANCELLED'] },
      processedAt: { lt: cutoffDate },
    },
  });

  logger.info('Email queue cleanup complete', {
    deleted: result.count,
    cutoffDate,
  });

  return result.count;
}
