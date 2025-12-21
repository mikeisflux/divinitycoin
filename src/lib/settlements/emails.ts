// lib/settlements/emails.ts
// Settlement email notifications

import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendgrid';
import { getConfig } from '@/lib/config';
import { SettlementStatus } from '@prisma/client';

// ============================================
// EMAIL HELPERS
// ============================================

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

async function getBaseUrl(): Promise<string> {
  return await getConfig('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000');
}

async function getAdminEmail(): Promise<string> {
  return await getConfig('ADMIN_NOTIFICATION_EMAIL', 'admin@divinitycoin.com');
}

// ============================================
// EMAIL TEMPLATES
// ============================================

interface SettlementEmailData {
  partnerName: string;
  partnerEmail: string;
  settlementId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  partnerFee: number;
  feePercentage: number;
  netAmount: number;
  captureCount: number;
  currency: string;
  status: SettlementStatus;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: Date;
}

async function buildSettlementCreatedEmail(data: SettlementEmailData): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const baseUrl = await getBaseUrl();
  const settlementUrl = `${baseUrl}/admin/settlements/${data.settlementId}`;

  const subject = `New Settlement Ready: ${data.partnerName} - ${formatCurrency(data.netAmount)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 50px; height: 50px; background: #6366f1; border-radius: 12px; line-height: 50px; color: white; font-weight: bold; font-size: 24px;">D</div>
      </div>

      <h1 style="color: #111827; font-size: 24px; margin-bottom: 20px;">New Settlement Ready for Review</h1>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
        A new settlement has been generated and requires review.
      </p>

      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Partner</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 600;">${data.partnerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${formatDateRange(data.periodStart, data.periodEnd)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Captures</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${data.captureCount}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Gross Amount</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${formatCurrency(data.grossAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Partner Fee (${(data.feePercentage * 100).toFixed(1)}%)</td>
            <td style="padding: 8px 0; color: #dc2626; font-size: 14px; text-align: right;">-${formatCurrency(data.partnerFee)}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0 8px; color: #111827; font-size: 16px; font-weight: 600;">Net Amount</td>
            <td style="padding: 12px 0 8px; color: #059669; font-size: 16px; text-align: right; font-weight: 600;">${formatCurrency(data.netAmount)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${settlementUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Review Settlement
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This is an automated notification from DivinityCoin.
      </p>
    </div>
  `;

  const text = `
New Settlement Ready for Review

Partner: ${data.partnerName}
Period: ${formatDateRange(data.periodStart, data.periodEnd)}
Captures: ${data.captureCount}

Gross Amount: ${formatCurrency(data.grossAmount)}
Partner Fee (${(data.feePercentage * 100).toFixed(1)}%): -${formatCurrency(data.partnerFee)}
Net Amount: ${formatCurrency(data.netAmount)}

Review: ${settlementUrl}
  `;

  return { subject, html, text };
}

async function buildSettlementPaidEmail(data: SettlementEmailData): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const baseUrl = await getBaseUrl();
  const settlementUrl = `${baseUrl}/partners/settlements/${data.settlementId}`;

  const subject = `Settlement Paid: ${formatCurrency(data.netAmount)} - ${formatDateRange(data.periodStart, data.periodEnd)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 50px; height: 50px; background: #6366f1; border-radius: 12px; line-height: 50px; color: white; font-weight: bold; font-size: 24px;">D</div>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; line-height: 60px;">
          <span style="color: #16a34a; font-size: 28px;">✓</span>
        </div>
      </div>

      <h1 style="color: #111827; font-size: 24px; margin-bottom: 10px; text-align: center;">Settlement Paid</h1>
      <p style="color: #6b7280; font-size: 16px; text-align: center; margin-bottom: 30px;">
        Your settlement has been paid successfully.
      </p>

      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Settlement ID</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${data.settlementId.slice(0, 8)}...</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${formatDateRange(data.periodStart, data.periodEnd)}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Gross Amount</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${formatCurrency(data.grossAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Partner Fee (${(data.feePercentage * 100).toFixed(1)}%)</td>
            <td style="padding: 8px 0; color: #dc2626; font-size: 14px; text-align: right;">-${formatCurrency(data.partnerFee)}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0 8px; color: #111827; font-size: 16px; font-weight: 600;">Net Amount</td>
            <td style="padding: 12px 0 8px; color: #059669; font-size: 16px; text-align: right; font-weight: 600;">${formatCurrency(data.netAmount)}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Method</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${data.paymentMethod || 'Wire Transfer'}</td>
          </tr>
          ${data.paymentRef ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Reference</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${data.paymentRef}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Paid On</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${data.paidAt ? formatDate(data.paidAt) : 'N/A'}</td>
          </tr>
        </table>
      </div>

      <p style="color: #4b5563; font-size: 14px; text-align: center; margin: 20px 0;">
        The funds should arrive in your account within 1-3 business days.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${settlementUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          View Settlement Details
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This is an automated notification from DivinityCoin.
      </p>
    </div>
  `;

  const text = `
Settlement Paid

Your settlement has been paid successfully.

Settlement ID: ${data.settlementId}
Period: ${formatDateRange(data.periodStart, data.periodEnd)}

Gross Amount: ${formatCurrency(data.grossAmount)}
Partner Fee (${(data.feePercentage * 100).toFixed(1)}%): -${formatCurrency(data.partnerFee)}
Net Amount: ${formatCurrency(data.netAmount)}

Payment Method: ${data.paymentMethod || 'Wire Transfer'}
${data.paymentRef ? `Payment Reference: ${data.paymentRef}` : ''}
Paid On: ${data.paidAt ? formatDate(data.paidAt) : 'N/A'}

The funds should arrive in your account within 1-3 business days.

View Details: ${settlementUrl}
  `;

  return { subject, html, text };
}

async function buildPaymentFailedEmail(data: SettlementEmailData, reason?: string): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const baseUrl = await getBaseUrl();
  const settlementUrl = `${baseUrl}/admin/settlements/${data.settlementId}`;

  const subject = `⚠️ Payment Failed: ${data.partnerName} - ${formatCurrency(data.netAmount)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 50px; height: 50px; background: #6366f1; border-radius: 12px; line-height: 50px; color: white; font-weight: bold; font-size: 24px;">D</div>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 60px; height: 60px; background: #fee2e2; border-radius: 50%; line-height: 60px;">
          <span style="color: #dc2626; font-size: 28px;">!</span>
        </div>
      </div>

      <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 10px; text-align: center;">Payment Failed</h1>
      <p style="color: #6b7280; font-size: 16px; text-align: center; margin-bottom: 30px;">
        A settlement payment has failed and requires attention.
      </p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="color: #dc2626; margin: 0; font-size: 14px;">
          <strong>Reason:</strong> ${reason || 'Payment processing failed. Please check payment details.'}
        </p>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Partner</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 600;">${data.partnerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Settlement ID</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${data.settlementId.slice(0, 8)}...</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 600;">${formatCurrency(data.netAmount)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${settlementUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Review Settlement
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This is an automated notification from DivinityCoin.
      </p>
    </div>
  `;

  const text = `
⚠️ Payment Failed

A settlement payment has failed and requires attention.

Partner: ${data.partnerName}
Settlement ID: ${data.settlementId}
Amount: ${formatCurrency(data.netAmount)}

Reason: ${reason || 'Payment processing failed. Please check payment details.'}

Review: ${settlementUrl}
  `;

  return { subject, html, text };
}

// ============================================
// EMAIL NOTIFICATION FUNCTIONS
// ============================================

async function getSettlementEmailData(settlementId: string): Promise<SettlementEmailData | null> {
  const settlement = await prisma.partnerSettlement.findUnique({
    where: { id: settlementId },
    include: {
      partner: { select: { name: true, contactEmail: true } },
      _count: { select: { captures: true } },
    },
  });

  if (!settlement) {
    return null;
  }

  return {
    partnerName: settlement.partner.name,
    partnerEmail: settlement.partner.contactEmail || '',
    settlementId: settlement.id,
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    grossAmount: Number(settlement.grossAmount),
    partnerFee: Number(settlement.partnerFee),
    feePercentage: Number(settlement.feePercentage),
    netAmount: Number(settlement.netAmount),
    captureCount: settlement._count.captures,
    currency: settlement.currency,
    status: settlement.status,
    paymentMethod: settlement.paymentMethod ?? undefined,
    paymentRef: settlement.paymentRef ?? undefined,
    paidAt: settlement.paidAt ?? undefined,
  };
}

/**
 * Send email when a new settlement is created (to admin)
 */
export async function sendSettlementCreatedEmail(settlementId: string): Promise<{ success: boolean; error?: string }> {
  const data = await getSettlementEmailData(settlementId);
  if (!data) {
    return { success: false, error: 'Settlement not found' };
  }

  const adminEmail = await getAdminEmail();
  const email = await buildSettlementCreatedEmail(data);

  return sendEmail({
    to: adminEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/**
 * Send email when a settlement is paid (to partner)
 */
export async function sendSettlementPaidEmail(settlementId: string): Promise<{ success: boolean; error?: string }> {
  const data = await getSettlementEmailData(settlementId);
  if (!data) {
    return { success: false, error: 'Settlement not found' };
  }

  if (!data.partnerEmail) {
    return { success: false, error: 'Partner email not configured' };
  }

  const email = await buildSettlementPaidEmail(data);

  return sendEmail({
    to: data.partnerEmail,
    toName: data.partnerName,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/**
 * Send email when a payment fails (to admin)
 */
export async function sendPaymentFailedEmail(settlementId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  const data = await getSettlementEmailData(settlementId);
  if (!data) {
    return { success: false, error: 'Settlement not found' };
  }

  const adminEmail = await getAdminEmail();
  const email = await buildPaymentFailedEmail(data, reason);

  return sendEmail({
    to: adminEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/**
 * Notify on settlement status change
 */
export async function notifySettlementStatusChange(
  settlementId: string,
  newStatus: SettlementStatus,
  reason?: string
): Promise<void> {
  switch (newStatus) {
    case SettlementStatus.PENDING:
      await sendSettlementCreatedEmail(settlementId);
      break;
    case SettlementStatus.PAID:
      await sendSettlementPaidEmail(settlementId);
      break;
    case SettlementStatus.FAILED:
      await sendPaymentFailedEmail(settlementId, reason);
      break;
  }
}
