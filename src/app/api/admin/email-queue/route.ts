// app/api/admin/email-queue/route.ts
// Email queue management API

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/admin/middleware';
import { prisma } from '@/lib/db';
import { getQueueStats, getBulkSendStatus, cancelPendingEmails, cleanupQueue } from '@/lib/email/queue';
import { logger } from '@/lib/logger';

// GET - Get queue status and statistics
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const bulkSendId = searchParams.get('bulkSendId');

    if (bulkSendId) {
      // Get status for a specific bulk send
      const status = await getBulkSendStatus(bulkSendId);
      return NextResponse.json(status);
    }

    // Get overall queue stats
    const stats = await getQueueStats();

    // Get recent queue items
    const recentItems = await prisma.emailQueue.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        toEmail: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        bulkSendId: true,
        createdAt: true,
        sentAt: true,
      },
    });

    return NextResponse.json({
      stats,
      recentItems,
    });
  } catch (error) {
    logger.apiError('/api/admin/email-queue', error);
    return NextResponse.json({ error: 'Failed to get queue status' }, { status: 500 });
  }
}

// POST - Queue actions (cancel, cleanup, retry)
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { action, bulkSendId, emailId } = body;

    switch (action) {
      case 'cancel': {
        const cancelled = await cancelPendingEmails(bulkSendId);
        return NextResponse.json({
          success: true,
          message: `Cancelled ${cancelled} pending emails`,
          cancelled,
        });
      }

      case 'cleanup': {
        const daysOld = body.daysOld || 30;
        const deleted = await cleanupQueue(daysOld);
        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted} old emails`,
          deleted,
        });
      }

      case 'retry': {
        if (!emailId) {
          return NextResponse.json({ error: 'Email ID required for retry' }, { status: 400 });
        }

        await prisma.emailQueue.update({
          where: { id: emailId },
          data: {
            status: 'PENDING',
            attempts: 0,
            lastError: null,
            nextRetryAt: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Email queued for retry',
        });
      }

      case 'retry-all-failed': {
        const updated = await prisma.emailQueue.updateMany({
          where: {
            status: 'FAILED',
            ...(bulkSendId ? { bulkSendId } : {}),
          },
          data: {
            status: 'PENDING',
            attempts: 0,
            lastError: null,
            nextRetryAt: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: `${updated.count} failed emails queued for retry`,
          count: updated.count,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.apiError('/api/admin/email-queue POST', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
