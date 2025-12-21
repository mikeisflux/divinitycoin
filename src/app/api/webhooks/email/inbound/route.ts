// app/api/webhooks/email/inbound/route.ts
// SendGrid Inbound Parse webhook handler for incoming emails

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
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
        status: 'RECEIVED',
        statusMessage: `Inbound email from ${from}`,
      },
    });

    console.log('Inbound email received:', {
      from,
      to,
      subject,
      senderIp,
      spamScore,
    });

    // You can add custom handling here:
    // - Auto-reply
    // - Forward to support system
    // - Create support ticket
    // - etc.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inbound email webhook error:', error);
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
