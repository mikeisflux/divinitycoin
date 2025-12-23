// lib/email/sendgrid.ts
// SendGrid email client

import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/db';
import { getConfig, clearConfigCache } from '@/lib/config';
import { logger } from '@/lib/logger';

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

async function getSendGridConfig(): Promise<SendGridConfig> {
  return {
    apiKey: await getConfig('SENDGRID_API_KEY', ''),
    fromEmail: await getConfig('SENDGRID_FROM_EMAIL', ''),
    fromName: await getConfig('SENDGRID_FROM_NAME', 'DivinityCoin'),
    replyTo: await getConfig('SENDGRID_REPLY_TO', ''),
  };
}

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const config = await getSendGridConfig();

  if (!config.apiKey) {
    logger.warn('SendGrid API key not configured');
    return { success: false, error: 'Email not configured. Please add SendGrid API key in admin settings.' };
  }

  if (!config.fromEmail) {
    logger.warn('SendGrid from email not configured');
    return { success: false, error: 'From email not configured. Please configure in admin settings.' };
  }

  try {
    // Set API key
    sgMail.setApiKey(config.apiKey);

    // Log email attempt
    const emailLog = await prisma.emailLog.create({
      data: {
        toEmail: params.to,
        toName: params.toName,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text || '',
        status: 'SENDING',
      },
    });

    const msg = {
      to: params.toName ? { email: params.to, name: params.toName } : params.to,
      from: { email: config.fromEmail, name: config.fromName },
      replyTo: params.replyTo || config.replyTo || config.fromEmail,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    const [response] = await sgMail.send(msg);
    const messageId = response.headers['x-message-id'] || '';

    // Update log with message ID
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'SENT',
        sendgridMessageId: messageId,
        sentAt: new Date(),
      },
    });

    return { success: true, messageId };
  } catch (error: unknown) {
    logger.error('SendGrid email send failed', { error, to: params.to });

    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';

    // Log failure
    await prisma.emailLog.create({
      data: {
        toEmail: params.to,
        toName: params.toName,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text || '',
        status: 'FAILED',
        statusMessage: errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}

export async function verifySendGridConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = await getSendGridConfig();

  if (!config.apiKey) {
    return { success: false, error: 'SendGrid API key not configured' };
  }

  if (!config.fromEmail) {
    return { success: false, error: 'From email not configured' };
  }

  // SendGrid doesn't have a verify method, so we just check config exists
  // The API key will be validated on first send
  if (config.apiKey.startsWith('SG.')) {
    return { success: true };
  }

  return { success: false, error: 'Invalid API key format. SendGrid API keys start with "SG."' };
}

export async function sendTestEmail(to: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return sendEmail({
    to,
    subject: 'Test Email from DivinityCoin',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">Test Email</h1>
        <p>This is a test email from your DivinityCoin installation.</p>
        <p>If you received this, your SendGrid configuration is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `,
    text: `Test Email from DivinityCoin\n\nThis is a test email. If you received this, your SendGrid configuration is working correctly!\n\nSent at: ${new Date().toISOString()}`,
  });
}

export { clearConfigCache };
