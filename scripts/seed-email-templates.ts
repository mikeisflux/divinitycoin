import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const emailTemplates = [
  {
    name: 'Gift Card Delivery',
    slug: 'gift_card_delivery',
    description: 'Sent when a gift card purchase is completed',
    subject: 'Your DivinityCoin Gift Card is Ready!',
    htmlContent: `
      <h1>Your Gift Card is Ready!</h1>
      <p>Thank you for your purchase! Your \${{amount}} DivinityCoin gift card is now active.</p>
      <div style="background:#f8fafc;border:2px dashed #e2e8f0;padding:24px;text-align:center;margin:24px 0;">
        <p style="color:#64748b;font-size:14px;margin:0 0 8px;">Your Gift Card Code:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:2px;margin:0;">{{code}}</p>
      </div>
      <p>Keep this email safe - you'll need this code to redeem your credits.</p>
    `,
    textContent: `Your DivinityCoin Gift Card is Ready!\n\nThank you for your purchase!\n\nYour Gift Card Code: {{code}}\nAmount: \${{amount}}\nValid Until: {{expiryDate}}\n\nKeep this code safe!`,
  },
  {
    name: 'Refund Confirmation',
    slug: 'refund_confirmation',
    description: 'Sent when a refund is processed',
    subject: 'Your DivinityCoin Refund Has Been Processed',
    htmlContent: `
      <h1>Refund Processed</h1>
      <p>We've processed your refund request. The funds should appear in your original payment method within 5-10 business days.</p>
      <div style="background:#fef3c7;padding:16px;border-left:4px solid #f59e0b;margin:20px 0;">
        <p><strong>Refund Amount:</strong> \${{amount}}</p>
        <p><strong>Date Processed:</strong> {{refundDate}}</p>
        <p><strong>Transaction ID:</strong> {{transactionId}}</p>
      </div>
      <p>Any gift card codes associated with this purchase have been revoked.</p>
    `,
    textContent: `Refund Processed\n\nWe've processed your refund request.\n\nRefund Amount: \${{amount}}\nDate Processed: {{refundDate}}\nTransaction ID: {{transactionId}}\n\nAny associated gift card codes have been revoked.`,
  },
  {
    name: 'Welcome Email',
    slug: 'welcome',
    description: 'Sent when a new user creates an account',
    subject: 'Welcome to DivinityCoin!',
    htmlContent: `
      <h1>Welcome to DivinityCoin!</h1>
      <p>Hi {{userName}},</p>
      <p>Thanks for joining DivinityCoin! We're excited to have you as part of our community.</p>
      <h3>What You Can Do</h3>
      <ul>
        <li>Purchase Gift Cards - Buy credits instantly with any major credit card</li>
        <li>Support Creators - Use your credits on partner platforms</li>
        <li>Secure & Private - Your transactions are protected</li>
      </ul>
      <a href="https://creatorcredits.com/buy" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">Get Your First Credits</a>
    `,
    textContent: `Welcome to DivinityCoin!\n\nHi {{userName}},\n\nThanks for joining DivinityCoin! We're excited to have you.\n\nGet started at https://creatorcredits.com/buy`,
  },
  {
    name: 'Password Reset',
    slug: 'password_reset',
    description: 'Sent when a password reset is requested',
    subject: 'Reset Your DivinityCoin Password',
    htmlContent: `
      <h1>Reset Your Password</h1>
      <p>We received a request to reset the password for your DivinityCoin account associated with {{email}}.</p>
      <a href="{{resetLink}}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">Reset Password</a>
      <p>This link will expire in {{expiresIn}}. If you didn't request a password reset, you can safely ignore this email.</p>
    `,
    textContent: `Reset Your Password\n\nWe received a request to reset your password.\n\nReset link: {{resetLink}}\n\nThis link expires in {{expiresIn}}.\n\nIf you didn't request this, ignore this email.`,
  },
  {
    name: 'Admin Alert',
    slug: 'admin_alert',
    description: 'Sent to admins for system alerts',
    subject: '[{{severity}}] {{alertType}}',
    htmlContent: `
      <h1>{{alertType}}</h1>
      <div style="background:#fef3c7;padding:16px;border-left:4px solid #f59e0b;margin:20px 0;">
        <p><strong>Severity:</strong> {{severity}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
      </div>
      <p>{{message}}</p>
      <a href="{{actionUrl}}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">{{actionLabel}}</a>
    `,
    textContent: `[{{severity}}] {{alertType}}\n\nTime: {{timestamp}}\n\n{{message}}\n\nAction: {{actionUrl}}`,
  },
  {
    name: 'Unredeemed Reminder',
    slug: 'unredeemed_reminder',
    description: 'Sent to remind users of unredeemed gift cards',
    subject: 'Don\'t Forget Your ${{amount}} DivinityCoin!',
    htmlContent: `
      <h1>Don't Forget Your Credits!</h1>
      <p>You have a \${{amount}} DivinityCoin gift card that hasn't been redeemed yet. It's been {{daysUnredeemed}} days since your purchase!</p>
      <div style="background:#fef3c7;border:2px dashed #f59e0b;padding:24px;text-align:center;margin:24px 0;">
        <p style="color:#92400e;font-size:14px;margin:0 0 8px;">Your Gift Card Code:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:2px;margin:0;color:#78350f;">{{code}}</p>
      </div>
      <p><strong>Valid Until:</strong> {{expiryDate}}</p>
      <a href="https://creatorcredits.com/redeem" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">Find Where to Redeem</a>
    `,
    textContent: `Don't Forget Your Credits!\n\nYou have a \${{amount}} gift card waiting!\n\nCode: {{code}}\nValid Until: {{expiryDate}}\n\nRedeem at: https://creatorcredits.com/redeem`,
  },
];

async function seed() {
  console.log('Seeding email templates...\n');

  for (const template of emailTemplates) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { slug: template.slug },
    });

    if (existing) {
      console.log(`Skipping "${template.name}" (already exists)`);
      continue;
    }

    const created = await prisma.emailTemplate.create({
      data: {
        name: template.name,
        slug: template.slug,
        description: template.description,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        isActive: true,
      },
    });

    console.log(`Created template: ${created.name}`);
  }

  console.log('\nEmail template seeding complete!');
}

seed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
