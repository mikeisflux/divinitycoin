// app/api/cron/process-email-queue/route.ts
// Cron endpoint to process email queue
// Call this every minute via cron: curl -X POST https://yoursite.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/email/queue';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = await getConfig('CRON_SECRET', '');

    // Allow if no secret configured (dev mode) or secret matches
    if (cronSecret && secret !== cronSecret) {
      logger.warn('Invalid cron secret for email queue processing');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Process up to 60 emails (1 minute of processing at 1/second)
    const stats = await processEmailQueue(60);

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    logger.apiError('/api/cron/process-email-queue', error);
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 });
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  return POST(request);
}
