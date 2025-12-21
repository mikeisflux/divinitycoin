// lib/email/sendGiftCard.ts

import { formatCodeForDisplay } from '@/lib/giftcard/generate';
import { sendEmail } from './sendgrid';

interface SendGiftCardParams {
  to: string;
  code: string;
  amount: number;
  toName?: string;
}

/**
 * Send gift card email with the redemption code
 */
export async function sendGiftCardEmail({
  to,
  code,
  amount,
  toName,
}: SendGiftCardParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formattedCode = formatCodeForDisplay(code);

  const subject = `Your $${amount.toFixed(2)} DivinityCoin Code`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your DivinityCoin Code</title>
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
                Your Credits Are Ready!
              </h1>

              <p style="margin: 0 0 30px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.5;">
                Thank you for your purchase. Use the code below to redeem your credits on any partner platform.
              </p>

              <!-- Amount -->
              <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 48px; font-weight: 700; color: #6366f1;">
                  $${amount.toFixed(2)}
                </span>
              </div>

              <!-- Code Box -->
              <div style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
                  Your Credit Code
                </p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; color: #111827; letter-spacing: 2px;">
                  ${formattedCode}
                </p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  How to Redeem
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                  <li>Visit your favorite partner platform</li>
                  <li>Go to their "Add Credits" or "Redeem Code" page</li>
                  <li>Enter the code above</li>
                  <li>Start supporting creators!</li>
                </ol>
              </div>

              <!-- Important Note -->
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
                <strong>Important:</strong> This code can only be used once. Keep it safe and don't share it with others.
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
Your DivinityCoin Code

Thank you for your purchase!

Amount: $${amount.toFixed(2)}
Code: ${formattedCode}

How to Redeem:
1. Visit your favorite partner platform
2. Go to their "Add Credits" or "Redeem Code" page
3. Enter the code above
4. Start supporting creators!

Important: This code can only be used once. Keep it safe and don't share it with others.

Need help? Contact us at support@divinitycoin.com

© ${new Date().getFullYear()} DivinityCoin. All rights reserved.
  `;

  return sendEmail({
    to,
    toName,
    subject,
    html: htmlContent,
    text: textContent,
  });
}
