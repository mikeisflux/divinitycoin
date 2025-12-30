# SendGrid Email Setup Guide

This guide covers how to configure SendGrid for both **sending** and **receiving** emails with DivinityCoin.

## Prerequisites

- A SendGrid account (https://sendgrid.com)
- Access to your domain's DNS settings
- Your domain verified with SendGrid

---

## Part 1: DNS Configuration

### 1.1 Domain Authentication (Required for Sending)

Add these DNS records to authenticate your domain for sending emails:

#### SPF Record
```
Type: TXT
Host: @
Value: v=spf1 include:sendgrid.net ~all
```

If you already have an SPF record, add `include:sendgrid.net` to it:
```
v=spf1 include:_spf.google.com include:sendgrid.net ~all
```

#### DKIM Records
SendGrid will provide specific DKIM records when you authenticate your domain. They typically look like:

```
Type: CNAME
Host: s1._domainkey
Value: s1.domainkey.u12345678.wl123.sendgrid.net

Type: CNAME
Host: s2._domainkey
Value: s2.domainkey.u12345678.wl123.sendgrid.net
```

#### Return Path (Optional but Recommended)
```
Type: CNAME
Host: em1234
Value: u12345678.wl123.sendgrid.net
```

### 1.2 MX Records (Required for Receiving)

To receive emails via SendGrid Inbound Parse, add this MX record:

```
Type: MX
Host: @ (or subdomain like "mail" for mail.yourdomain.com)
Priority: 10
Value: mx.sendgrid.net
```

**Important:** If you want to receive emails at a subdomain (recommended), use:
```
Type: MX
Host: mail (for mail.yourdomain.com)
Priority: 10
Value: mx.sendgrid.net
```

This allows you to receive at addresses like `support@mail.yourdomain.com`.

---

## Part 2: SendGrid Dashboard Configuration

### 2.1 Create API Key

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Name: `DivinityCoin Production`
4. Permissions: **Full Access** (or restrict to Mail Send)
5. Copy the key (starts with `SG.`)

### 2.2 Domain Authentication

1. Go to **Settings → Sender Authentication**
2. Click **Authenticate Your Domain**
3. Select your DNS provider
4. Enter your domain name
5. Follow the provided DNS instructions
6. Click **Verify** once records are added

### 2.3 Event Webhook (For Email Tracking)

1. Go to **Settings → Mail Settings → Event Webhook**
2. Enable the webhook
3. HTTP POST URL: `https://yourdomain.com/webhook/sendgrid`
4. Select events to track:
   - Processed
   - Delivered
   - Opened
   - Clicked
   - Bounced
   - Spam Report
   - Unsubscribe
5. Enable **Signed Event Webhook**
6. Copy the **Verification Key** for your `.env`

### 2.4 Inbound Parse Setup (For Receiving Emails)

1. Go to **Settings → Inbound Parse**
2. Click **Add Host & URL**
3. Configure:
   - **Receiving Domain**: Your domain (e.g., `mail.yourdomain.com`)
   - **Destination URL**: `https://yourdomain.com/api/webhooks/email/inbound?secret=YOUR_SECRET`
   - Check **POST the raw, full MIME message**
   - Check **Check incoming emails for spam**
4. Click **Add**

---

## Part 3: Environment Variables

Add these to your `.env` file:

```bash
# SendGrid API Key (from step 2.1)
SENDGRID_API_KEY="SG.xxxxxxxxxxxxxxxxxxxx"

# Default sender email (must be verified in SendGrid)
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
SENDGRID_FROM_NAME="DivinityCoin"

# Event webhook verification key (from step 2.3)
SENDGRID_WEBHOOK_VERIFICATION_KEY="your-public-key-from-sendgrid"

# Inbound parse webhook secret (generate with: openssl rand -base64 32)
SENDGRID_INBOUND_WEBHOOK_SECRET="your-random-secret-here"
```

Generate the inbound webhook secret:
```bash
openssl rand -base64 32
```

---

## Part 4: Complete DNS Record Summary

Here's a complete example for `yourdomain.com`:

| Type  | Host              | Priority | Value                                      |
|-------|-------------------|----------|-------------------------------------------|
| TXT   | @                 | -        | v=spf1 include:sendgrid.net ~all         |
| CNAME | s1._domainkey     | -        | s1.domainkey.u12345678.wl123.sendgrid.net |
| CNAME | s2._domainkey     | -        | s2.domainkey.u12345678.wl123.sendgrid.net |
| CNAME | em1234            | -        | u12345678.wl123.sendgrid.net             |
| MX    | mail              | 10       | mx.sendgrid.net                          |

**Note:** The CNAME values for DKIM and Return Path are unique to your SendGrid account. Get the exact values from your SendGrid dashboard under **Sender Authentication**.

---

## Part 5: Testing

### Test Sending
1. Go to Admin → Settings → Email
2. Enter a test email address
3. Click "Send Test Email"
4. Check your inbox

### Test Receiving
1. Go to Admin → Inbox → Mailboxes
2. Create a mailbox (e.g., `support@mail.yourdomain.com`)
3. Send an email to that address from an external account
4. Check Admin → Inbox for the received email

---

## Part 6: Mailbox Configuration

### Create Mailboxes in Admin

1. Go to **Admin → Inbox → Manage Mailboxes**
2. Click **Add Mailbox**
3. Configure:
   - **Email**: The receiving address (e.g., `support@mail.yourdomain.com`)
   - **Name**: Display name (e.g., "Support")
   - **Auto-Reply**: Enable if you want automatic responses
   - **Signature**: Add a signature for outgoing emails

### Auto-Reply Settings

When enabled, auto-replies are sent automatically to incoming emails:
- Not sent to spam
- Customizable subject and message
- Includes mailbox signature

---

## Troubleshooting

### Emails Not Sending
1. Verify API key is correct (starts with `SG.`)
2. Check sender domain is authenticated
3. Check SendGrid Activity Feed for errors
4. Verify SPF/DKIM records are propagated (use MXToolbox)

### Emails Not Receiving
1. Verify MX record is correct: `dig MX mail.yourdomain.com`
2. Check Inbound Parse is configured correctly
3. Verify webhook URL is accessible
4. Check server logs for webhook errors
5. Ensure secret in URL matches `SENDGRID_INBOUND_WEBHOOK_SECRET`

### Webhook Errors
1. Verify HTTPS certificate is valid
2. Check webhook secret matches
3. Ensure server responds within 20 seconds
4. Check for firewall blocks on webhook endpoints

### DNS Propagation
DNS changes can take up to 48 hours. Check propagation:
```bash
# Check MX record
dig MX mail.yourdomain.com

# Check SPF record
dig TXT yourdomain.com

# Check DKIM
dig CNAME s1._domainkey.yourdomain.com
```

Or use online tools:
- https://mxtoolbox.com/
- https://dnschecker.org/

---

## Security Considerations

1. **Never commit secrets** - Use environment variables
2. **Verify webhooks** - Always validate webhook signatures
3. **Use HTTPS** - All webhook endpoints must use HTTPS
4. **Rotate secrets periodically** - Update API keys and webhook secrets
5. **Monitor activity** - Check SendGrid dashboard for suspicious activity

---

## Webhook Endpoints

| Endpoint                              | Purpose                    |
|---------------------------------------|----------------------------|
| `/webhook/sendgrid`                   | Email delivery events      |
| `/api/webhooks/email/inbound`         | Inbound email receiving    |

---

## Quick Reference

### Minimum Required DNS Records

For sending only:
```
TXT  @  v=spf1 include:sendgrid.net ~all
```

For sending and receiving:
```
TXT  @     v=spf1 include:sendgrid.net ~all
MX   mail  10  mx.sendgrid.net
```

### Required Environment Variables

```bash
SENDGRID_API_KEY="SG.xxx"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
SENDGRID_FROM_NAME="YourApp"
SENDGRID_INBOUND_WEBHOOK_SECRET="xxx"
```
