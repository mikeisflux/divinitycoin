// app/webhook/sendgrid/route.ts
// SendGrid event webhook handler

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

interface SendGridEvent {
  email: string;
  timestamp: number;
  'smtp-id': string;
  event: string;
  category?: string[];
  sg_event_id: string;
  sg_message_id: string;
  response?: string;
  attempt?: string;
  useragent?: string;
  ip?: string;
  url?: string;
  reason?: string;
  status?: string;
  type?: string;
}

function verifySignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!process.env.SENDGRID_WEBHOOK_SECRET) {
    console.warn('SENDGRID_WEBHOOK_SECRET not set, skipping verification');
    return true;
  }

  try {
    const timestampPayload = timestamp + payload;
    const decodedPublicKey = Buffer.from(publicKey, 'base64');
    const decodedSignature = Buffer.from(signature, 'base64');

    const verify = crypto.createVerify('SHA256');
    verify.update(timestampPayload);

    return verify.verify(
      {
        key: decodedPublicKey,
        format: 'der',
        type: 'spki',
      },
      decodedSignature
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function mapEventToStatus(event: string): string {
  const statusMap: Record<string, string> = {
    'processed': 'SENDING',
    'deferred': 'SENDING',
    'delivered': 'DELIVERED',
    'open': 'OPENED',
    'click': 'CLICKED',
    'bounce': 'BOUNCED',
    'dropped': 'FAILED',
    'spamreport': 'SPAM',
    'unsubscribe': 'SENT',
  };
  return statusMap[event] || 'SENT';
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature') || '';
    const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp') || '';

    // Verify signature if secret is set
    if (process.env.SENDGRID_WEBHOOK_SECRET) {
      const isValid = verifySignature(
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || '',
        rawBody,
        signature,
        timestamp
      );

      if (!isValid) {
        console.error('Invalid SendGrid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const events: SendGridEvent[] = JSON.parse(rawBody);

    for (const event of events) {
      try {
        // Find the email log by SendGrid message ID
        const emailLog = await prisma.emailLog.findFirst({
          where: { sendgridMessageId: event.sg_message_id },
        });

        if (emailLog) {
          // Update email status
          const newStatus = mapEventToStatus(event.event);

          await prisma.emailLog.update({
            where: { id: emailLog.id },
            data: {
              status: newStatus as any,
              statusMessage: event.reason || event.response || null,
              deliveredAt: event.event === 'delivered' ? new Date(event.timestamp * 1000) : undefined,
              openedAt: event.event === 'open' ? new Date(event.timestamp * 1000) : undefined,
              clickedAt: event.event === 'click' ? new Date(event.timestamp * 1000) : undefined,
              bouncedAt: event.event === 'bounce' ? new Date(event.timestamp * 1000) : undefined,
            },
          });

          // Create email event record
          await prisma.emailEvent.create({
            data: {
              emailLogId: emailLog.id,
              event: event.event,
              timestamp: new Date(event.timestamp * 1000),
              data: JSON.stringify(event),
            },
          });
        }
      } catch (eventError) {
        console.error('Error processing SendGrid event:', eventError, event);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
