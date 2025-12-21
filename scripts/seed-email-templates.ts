import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const emailTemplates = [
  {
    name: 'gift_card_delivery',
    subject: 'Your CreatorCredits Gift Card is Ready! 🎉',
    description: 'Sent when a gift card purchase is completed',
    category: 'transactional',
    variables: JSON.stringify(['code', 'amount', 'recipientEmail', 'purchaseDate', 'expiryDate']),
    htmlContent: `
      <h1>Your Gift Card is Ready!</h1>
      <p>Thank you for your purchase! Your \${{amount}} CreatorCredits gift card is now active.</p>
      <div style="background:#f8fafc;border:2px dashed #e2e8f0;padding:24px;text-align:center;margin:24px 0;">
        <p style="color:#64748b;font-size:14px;margin:0 0 8px;">Your Gift Card Code:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:2px;margin:0;">{{code}}</p>
      </div>
      <p>Keep this email safe - you'll need this code to redeem your credits.</p>
    `,
    textContent: `Your CreatorCredits Gift Card is Ready!\n\nThank you for your purchase!\n\nYour Gift Card Code: {{code}}\nAmount: \${{amount}}\nValid Until: {{expiryDate}}\n\nKeep this code safe!`,
  },
  {
    name: 'refund_confirmation',
    subject: 'Your CreatorCredits Refund Has Been Processed',
    description: 'Sent when a refund is processed',
    category: 'transactional',
    variables: JSON.stringify(['amount', 'refundDate', 'transactionId', 'reason']),
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
    name: 'welcome',
    subject: 'Welcome to CreatorCredits! 🎉',
    description: 'Sent when a new user creates an account',
    category: 'transactional',
    variables: JSON.stringify(['userName', 'email']),
    htmlContent: `
      <h1>Welcome to CreatorCredits!</h1>
      <p>Hi {{userName}},</p>
      <p>Thanks for joining CreatorCredits! We're excited to have you as part of our community.</p>
      <h3>What You Can Do</h3>
      <ul>
        <li>Purchase Gift Cards - Buy credits instantly with any major credit card</li>
        <li>Support Creators - Use your credits on partner platforms</li>
        <li>Secure & Private - Your transactions are protected</li>
      </ul>
      <a href="https://creatorcredits.com/buy" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">Get Your First Credits</a>
    `,
    textContent: `Welcome to CreatorCredits!\n\nHi {{userName}},\n\nThanks for joining CreatorCredits! We're excited to have you.\n\nGet started at https://creatorcredits.com/buy`,
  },
  {
    name: 'password_reset',
    subject: 'Reset Your CreatorCredits Password',
    description: 'Sent when a password reset is requested',
    category: 'transactional',
    variables: JSON.stringify(['email', 'resetLink', 'expiresIn']),
    htmlContent: `
      <h1>Reset Your Password</h1>
      <p>We received a request to reset the password for your CreatorCredits account associated with {{email}}.</p>
      <a href="{{resetLink}}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;">Reset Password</a>
      <p>This link will expire in {{expiresIn}}. If you didn't request a password reset, you can safely ignore this email.</p>
      <div style="background:#fef2f2;padding:16px;border-left:4px solid #ef4444;margin:20px 0;">
        <p style="color:#991b1b;margin:0;"><strong>Security Tips:</strong></p>
        <p style="color:#991b1b;margin:4px 0;">• Never share this link with anyone</p>
        <p style="color:#991b1b;margin:4px 0;">• CreatorCredits will never ask for your password via email</p>
      </div>
    `,
    textContent: `Reset Your Password\n\nWe received a request to reset your password.\n\nReset link: {{resetLink}}\n\nThis link expires in {{expiresIn}}.\n\nIf you didn't request this, ignore this email.`,
  },
  {
    name: 'admin_alert',
    subject: '[{{severity}}] {{alertType}}',
    description: 'Sent to admins for system alerts',
    category: 'admin',
    variables: JSON.stringify(['alertType', 'severity', 'message', 'details', 'timestamp', 'actionUrl', 'actionLabel']),
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
    name: 'unredeemed_reminder',
    subject: 'Don\'t Forget Your ${{amount}} CreatorCredits! 🎁',
    description: 'Sent to remind users of unredeemed gift cards',
    category: 'marketing',
    variables: JSON.stringify(['code', 'amount', 'purchaseDate', 'daysUnredeemed', 'expiryDate']),
    htmlContent: `
      <h1>Don't Forget Your Credits! 🎁</h1>
      <p>You have a \${{amount}} CreatorCredits gift card that hasn't been redeemed yet. It's been {{daysUnredeemed}} days since your purchase!</p>
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
  console.log('🌱 Seeding email templates...\n');

  for (const template of emailTemplates) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { name: template.name },
    });

    if (existing) {
      console.log(`⏭️  Skipping "${template.name}" (already exists)`);
      continue;
    }

    const created = await prisma.emailTemplate.create({
      data: {
        name: template.name,
        subject: template.subject,
        description: template.description,
        category: template.category,
        variables: template.variables,
        isActive: true,
        versions: {
          create: {
            version: 1,
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent,
            isActive: true,
            createdBy: 'system',
          },
        },
      },
    });

    console.log(`✅ Created template: ${created.name}`);
  }

  console.log('\n✨ Email template seeding complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
