// lib/email/sendRedemptionReminder.ts

import { sendEmail } from './sendgrid';

interface SendReminderParams {
  to: string;
  toName?: string;
  amount: number;
  codeLast4: string;
  partnerName?: string;
}

/**
 * Send reminder email to redeem gift card on partner platform
 */
export async function sendRedemptionReminderEmail({
  to,
  toName,
  amount,
  codeLast4,
  partnerName,
}: SendReminderParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `Reminder: Redeem Your $${amount.toFixed(2)} DivinityCoin Credits`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redeem Your Credits</title>
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
                Don't Forget Your Credits!
              </h1>

              <p style="margin: 0 0 30px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.5;">
                You have <strong>$${amount.toFixed(2)}</strong> in credits waiting to be redeemed${partnerName ? ` on ${partnerName}` : ''}.
              </p>

              <!-- Amount Display -->
              <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 48px; font-weight: 700; color: #6366f1;">
                  $${amount.toFixed(2)}
                </span>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #9ca3af;">
                  Code ending in ****${codeLast4}
                </p>
              </div>

              <!-- Call to Action -->
              <div style="text-align: center; margin-bottom: 30px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #4b5563;">
                  Head over to ${partnerName || 'your partner platform'} and redeem your code to start supporting creators!
                </p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #f0f7ff; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  How to Redeem
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                  <li>Visit ${partnerName || 'the partner platform'}</li>
                  <li>Go to "Add Credits" or "Redeem Code"</li>
                  <li>Enter your code (check your original email)</li>
                  <li>Start supporting creators!</li>
                </ol>
              </div>

              <!-- Support Section -->
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #92400e;">
                  Need Help?
                </h3>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e;">
                  If you're having trouble redeeming your code or can't find your original email, we're here to help:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #92400e; line-height: 1.8;">
                  <li>Read our guide: <a href="https://indiecrowdfund.com/backer-handbook#divinitycoin" style="color: #6366f1; text-decoration: underline;">Backer Handbook - DivinityCoin</a></li>
                  <li>Join our Discord: <a href="https://discord.gg/KqJXPG9fA5" style="color: #6366f1; text-decoration: underline;">discord.gg/KqJXPG9fA5</a></li>
                  <li>Email us: <a href="mailto:divinitycomicsinc@gmail.com" style="color: #6366f1; text-decoration: underline;">divinitycomicsinc@gmail.com</a></li>
                </ul>
              </div>
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
                &copy; ${new Date().getFullYear()} DivinityCoin. All rights reserved.
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
Don't Forget Your DivinityCoin Credits!

You have $${amount.toFixed(2)} in credits waiting to be redeemed${partnerName ? ` on ${partnerName}` : ''}.

Amount: $${amount.toFixed(2)}
Code ending in: ****${codeLast4}

Head over to ${partnerName || 'your partner platform'} and redeem your code to start supporting creators!

How to Redeem:
1. Visit ${partnerName || 'the partner platform'}
2. Go to "Add Credits" or "Redeem Code"
3. Enter your code (check your original email)
4. Start supporting creators!

Need Help?
If you're having trouble redeeming your code or can't find your original email:
- Read our guide: https://indiecrowdfund.com/backer-handbook#divinitycoin
- Join our Discord: https://discord.gg/KqJXPG9fA5
- Email us: divinitycomicsinc@gmail.com

Need help? Contact us at support@divinitycoin.com

(c) ${new Date().getFullYear()} DivinityCoin. All rights reserved.
  `;

  return sendEmail({
    to,
    toName,
    subject,
    html: htmlContent,
    text: textContent,
  });
}
