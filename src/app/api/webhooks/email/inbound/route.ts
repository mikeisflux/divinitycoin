// app/api/webhooks/email/inbound/route.ts
// SendGrid Inbound Parse webhook handler for incoming emails

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';
import crypto from 'crypto';

// Parse email address from "Name <email@domain.com>" format
function parseEmailAddress(raw: string): { email: string; name: string | null } {
  if (!raw) return { email: '', name: null };

  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]?.trim().toLowerCase() || raw.toLowerCase(),
    };
  }
  return { email: raw.toLowerCase(), name: null };
}

// Extract recipient email addresses from "to" field
function parseRecipients(to: string): string[] {
  if (!to) return [];
  return to.split(',').map(addr => {
    const parsed = parseEmailAddress(addr.trim());
    return parsed.email;
  }).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify webhook secret (passed as URL parameter from SendGrid config)
    const webhookSecret = process.env.SENDGRID_INBOUND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(request.url);
      const providedSecret = url.searchParams.get('secret');

      if (!providedSecret || !crypto.timingSafeEqual(
        Buffer.from(providedSecret),
        Buffer.from(webhookSecret)
      )) {
        logger.warn('Invalid inbound email webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // SendGrid sends inbound emails as multipart/form-data
    const formData = await request.formData();

    const from = formData.get('from') as string || '';
    const to = formData.get('to') as string || '';
    const cc = formData.get('cc') as string || '';
    const subject = formData.get('subject') as string || '(no subject)';
    const text = formData.get('text') as string || '';
    const html = formData.get('html') as string || '';
    const envelope = formData.get('envelope') as string || '';
    const senderIp = formData.get('sender_ip') as string || '';
    const spamScore = formData.get('spam_score') as string || '';
    const spamReport = formData.get('spam_report') as string || '';
    const attachmentCount = parseInt(formData.get('attachments') as string || '0', 10);
    const headers = formData.get('headers') as string || '';

    // Parse from address
    const sender = parseEmailAddress(from);

    // Parse recipients
    const toAddresses = parseRecipients(to);
    const ccAddresses = parseRecipients(cc);

    // Parse envelope for additional info
    let envelopeData: { to?: string[]; from?: string } | null = null;
    if (envelope) {
      try {
        envelopeData = JSON.parse(envelope);
      } catch {
        // Ignore parsing errors
      }
    }

    // Extract Message-ID from headers
    let messageId: string | null = null;
    let inReplyTo: string | null = null;
    if (headers) {
      const messageIdMatch = headers.match(/Message-ID:\s*<?([^>\s]+)>?/i);
      if (messageIdMatch) messageId = messageIdMatch[1];

      const inReplyToMatch = headers.match(/In-Reply-To:\s*<?([^>\s]+)>?/i);
      if (inReplyToMatch) inReplyTo = inReplyToMatch[1];
    }

    // Find matching mailbox for each recipient
    const recipientEmails = envelopeData?.to || toAddresses;

    for (const recipientEmail of recipientEmails) {
      // Try to find a mailbox for this recipient
      let mailbox = await prisma.mailbox.findUnique({
        where: { email: recipientEmail.toLowerCase() },
      });

      // If no exact match, try to create a catch-all mailbox or find default
      if (!mailbox) {
        // Check for domain catch-all (e.g., *@divinitycoin.com -> default mailbox)
        mailbox = await prisma.mailbox.findFirst({
          where: { isDefault: true, isActive: true },
        });
      }

      // If still no mailbox, create one for this email
      if (!mailbox) {
        mailbox = await prisma.mailbox.create({
          data: {
            email: recipientEmail.toLowerCase(),
            name: recipientEmail.split('@')[0] || 'Inbox',
            isActive: true,
            isDefault: recipientEmails.length === 1, // Make default if only recipient
          },
        });
        logger.info('Auto-created mailbox for inbound email', {
          mailboxId: mailbox.id,
          email: mailbox.email,
        });
      }

      // Determine spam status
      const isSpam = parseFloat(spamScore) > 5;

      // Generate thread ID (use In-Reply-To or create new)
      const threadId = inReplyTo || messageId || crypto.randomUUID();

      // Check for duplicate message (same messageId already exists)
      if (messageId) {
        const existingEmail = await prisma.email.findFirst({
          where: { messageId, mailboxId: mailbox.id },
        });
        if (existingEmail) {
          logger.info('Duplicate inbound email skipped', {
            messageId,
            mailboxId: mailbox.id,
            existingEmailId: existingEmail.id,
          });
          continue; // Skip this recipient, already processed
        }
      }

      // Create the email record
      const email = await prisma.email.create({
        data: {
          mailboxId: mailbox.id,
          direction: 'INBOUND',
          fromEmail: sender.email,
          fromName: sender.name,
          toEmail: recipientEmail.toLowerCase(),
          ccEmails: ccAddresses,
          subject,
          textBody: text,
          htmlBody: html,
          messageId,
          inReplyTo,
          threadId,
          folder: isSpam ? 'SPAM' : 'INBOX',
          isSpam,
          spamScore: parseFloat(spamScore) || null,
          senderIp,
          hasAttachments: attachmentCount > 0,
          receivedAt: new Date(),
        },
      });

      // Handle attachments if any
      if (attachmentCount > 0) {
        for (let i = 1; i <= attachmentCount; i++) {
          const attachment = formData.get(`attachment${i}`) as File | null;
          if (attachment) {
            await prisma.emailAttachment.create({
              data: {
                emailId: email.id,
                filename: attachment.name,
                contentType: attachment.type,
                size: attachment.size,
                // Note: For production, you'd upload to S3/storage and store the key
              },
            });
          }
        }
      }

      logger.info('Inbound email saved', {
        emailId: email.id,
        mailboxId: mailbox.id,
        from: sender.email,
        to: recipientEmail,
        subject,
        isSpam,
      });

      // Send auto-reply if enabled and not spam
      if (mailbox.autoReplyEnabled && !isSpam && sender.email) {
        try {
          const autoReplySubject = mailbox.autoReplySubject || `Re: ${subject}`;
          const autoReplyMessage = mailbox.autoReplyMessage ||
            'Thank you for your email. We have received your message and will respond as soon as possible.';

          await sendEmail({
            to: sender.email,
            toName: sender.name || undefined,
            subject: autoReplySubject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                ${autoReplyMessage.replace(/\n/g, '<br>')}
                ${mailbox.signature ? `<br><br>--<br>${mailbox.signature}` : ''}
              </div>
            `,
            text: `${autoReplyMessage}\n\n${mailbox.signature ? `--\n${mailbox.signature}` : ''}`,
            fromEmail: mailbox.email,
            fromName: mailbox.name,
            replyTo: mailbox.email,
          });

          logger.info('Auto-reply sent', {
            mailboxId: mailbox.id,
            to: sender.email,
          });
        } catch (autoReplyError) {
          logger.error('Failed to send auto-reply', {
            mailboxId: mailbox.id,
            error: autoReplyError,
          });
        }
      }
    }

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
