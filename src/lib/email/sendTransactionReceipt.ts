// lib/email/sendTransactionReceipt.ts

import { sendEmail } from './sendgrid';

interface SendTransactionReceiptParams {
  to: string;
  transactionId: string;
  amount: number;
  type: 'CANCELLED' | 'REFUNDED';
  originalDate: Date;
  giftCardLast4?: string;
}

/**
 * Send transaction receipt email for cancelled or refunded transactions
 */
export async function sendTransactionReceiptEmail({
  to,
  transactionId,
  amount,
  type,
  originalDate,
  giftCardLast4,
}: SendTransactionReceiptParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const isRefund = type === 'REFUNDED';
  const actionText = isRefund ? 'Refunded' : 'Cancelled';
  const actionDescription = isRefund
    ? 'Your payment has been refunded. The funds will be returned to your original payment method within 5-10 business days.'
    : 'Your transaction has been cancelled. No charges were made to your payment method.';

  const subject = `DivinityCoin Transaction ${actionText} - $${amount.toFixed(2)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction ${actionText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
          <tr>
            <td align="center">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <div style="width: 40px; height: 40px; background-color: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-weight: bold; font-size: 20px;">D</span>
                </div>
                <span style="font-size: 24px; font-weight: 600; color: #111827;">
                  Divinity<span style="color: #6366f1;">Coin</span>
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                Transaction ${actionText}
              </h1>

              <p style="margin: 0 0 30px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.5;">
                ${actionDescription}
              </p>

              <!-- Amount -->
              <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 48px; font-weight: 700; color: ${isRefund ? '#dc2626' : '#f59e0b'};">
                  ${isRefund ? '-' : ''}$${amount.toFixed(2)}
                </span>
              </div>

              <!-- Transaction Details -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Transaction Details
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction ID</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${transactionId.slice(0, 8)}...</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Original Date</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${originalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; background-color: ${isRefund ? '#fef2f2' : '#fef3c7'}; color: ${isRefund ? '#991b1b' : '#92400e'};">
                        ${actionText.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  ${giftCardLast4 ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Gift Card</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">****${giftCardLast4}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              ${isRefund ? `
              <!-- Refund Note -->
              <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
                  <strong>Note:</strong> If you had a gift card code associated with this transaction, it has been revoked and can no longer be used.
                </p>
              </div>
              ` : ''}

              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
                If you have any questions about this transaction, please contact our support team.
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
          <tr>
            <td align="center">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #9ca3af;">
                Need help? Contact us at support@divinitycoin.com
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} DivinityCoin. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Transaction ${actionText}

${actionDescription}

Amount: ${isRefund ? '-' : ''}$${amount.toFixed(2)}

Transaction Details:
- Transaction ID: ${transactionId.slice(0, 8)}...
- Original Date: ${originalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
- Status: ${actionText.toUpperCase()}
${giftCardLast4 ? `- Gift Card: ****${giftCardLast4}` : ''}

${isRefund ? 'Note: If you had a gift card code associated with this transaction, it has been revoked and can no longer be used.\n' : ''}
If you have any questions about this transaction, please contact our support team.

Need help? Contact us at support@divinitycoin.com

© ${new Date().getFullYear()} DivinityCoin. All rights reserved.
  `;

  return sendEmail({
    to,
    subject,
    html: htmlContent,
    text: textContent,
  });
}
