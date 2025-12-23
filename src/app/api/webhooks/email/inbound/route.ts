// app/api/webhooks/email/inbound/route.ts
// SendGrid Inbound Parse webhook handler for incoming emails

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify webhook secret (passed as URL parameter from SendGrid config)
    const webhookSecret = process.env.SENDGRID_INBOUND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('SENDGRID_INBOUND_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook security not configured' },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const providedSecret = url.searchParams.get('secret');

    if (!providedSecret || !crypto.timingSafeEqual(
      Buffer.from(providedSecret),
      Buffer.from(webhookSecret)
    )) {
      logger.warn('Invalid inbound email webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SendGrid sends inbound emails as multipart/form-data
    const formData = await request.formData();

    const from = formData.get('from') as string;
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    const envelope = formData.get('envelope') as string;
    const senderIp = formData.get('sender_ip') as string;
    const spamScore = formData.get('spam_score') as string;

    // Parse envelope for additional info
    let envelopeData = null;
    if (envelope) {
      try {
        envelopeData = JSON.parse(envelope);
      } catch {
        // Ignore parsing errors
      }
    }

    // Log the inbound email
    await prisma.emailLog.create({
      data: {
        toEmail: to || '',
        fromEmail: from || '',
        fromName: from?.split('<')[0]?.trim() || '',
        subject: subject || '(no subject)',
        htmlContent: html || '',
        textContent: text || '',
        status: 'DELIVERED',
        statusMessage: `Inbound email from ${from}`,
      },
    });

    logger.info('Inbound email received', {
      from,
      to,
      subject,
      senderIp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.apiError('/api/webhooks/email/inbound', error);
    return NextResponse.json(
      { error: 'Failed to process inbound email' },
      { status: 500 }
    );
  }
}

// Also handle GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'inbound-email' });
}
