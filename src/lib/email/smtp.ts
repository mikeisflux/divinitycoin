// lib/email/smtp.ts
// SMTP email client using nodemailer for Office 365/GoDaddy

import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

function getSmtpConfig(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  };
}

function createTransporter() {
  const config = getSmtpConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
  });
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
  const config = getSmtpConfig();
  const fromEmail = process.env.SMTP_FROM_EMAIL || config.user;
  const fromName = process.env.SMTP_FROM_NAME || 'DivinityCoin';

  if (!config.user || !config.pass) {
    console.error('SMTP credentials not configured');
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    // Log email attempt
    const emailLog = await prisma.emailLog.create({
      data: {
        toEmail: params.to,
        toName: params.toName,
        fromEmail,
        fromName,
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text || '',
        status: 'SENDING',
      },
    });

    const transporter = createTransporter();

    const result = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
      replyTo: params.replyTo || fromEmail,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    // Update log with message ID
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'SENT',
        sendgridMessageId: result.messageId, // Reusing field for SMTP message ID
        sentAt: new Date(),
      },
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('SMTP error:', error);

    // Log failure
    await prisma.emailLog.create({
      data: {
        toEmail: params.to,
        toName: params.toName,
        fromEmail,
        fromName,
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text || '',
        status: 'FAILED',
        statusMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export async function verifySmtpConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = getSmtpConfig();

  if (!config.user || !config.pass) {
    return { success: false, error: 'SMTP credentials not configured' };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
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
        <p>If you received this, your SMTP configuration is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </div>
    `,
    text: `Test Email from DivinityCoin\n\nThis is a test email. If you received this, your SMTP configuration is working correctly!\n\nSent at: ${new Date().toISOString()}`,
  });
}
