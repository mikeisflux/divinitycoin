// app/api/webhooks/sendgrid/route.ts
// SendGrid webhook handler for email events

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'dropped' | 'delivered' | 'deferred' | 'bounce' | 'open' | 'click' | 'spam_report' | 'unsubscribe';
  sg_message_id: string;
  reason?: string;
  status?: string;
  response?: string;
}

export async function POST(request: NextRequest) {
  try {
    const events: SendGridEvent[] = await request.json();

    for (const event of events) {
      // Find email log by SendGrid message ID
      const emailLog = await prisma.emailLog.findFirst({
        where: { sendgridMessageId: event.sg_message_id },
      });

      if (!emailLog) {
        console.log(`No email log found for message ID: ${event.sg_message_id}`);
        continue;
      }

      // Update email log based on event type
      let status = emailLog.status;
      let statusMessage = emailLog.statusMessage;

      switch (event.event) {
        case 'delivered':
          status = 'DELIVERED';
          statusMessage = 'Email delivered successfully';
          break;
        case 'bounce':
          status = 'BOUNCED';
          statusMessage = event.reason || 'Email bounced';
          break;
        case 'dropped':
          status = 'FAILED';
          statusMessage = event.reason || 'Email dropped';
          break;
        case 'deferred':
          status = 'QUEUED';
          statusMessage = event.response || 'Email deferred - will retry';
          break;
        case 'spam_report':
          status = 'SPAM';
          statusMessage = 'Marked as spam';
          break;
        case 'open':
          // Track opens if needed
          break;
        case 'click':
          // Track clicks if needed
          break;
      }

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status,
          statusMessage,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
