// lib/partner/webhook.ts
// Partner webhook utilities

import crypto from 'crypto';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
}

export function generateWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signaturePayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

export async function sendWebhook(
  webhookUrl: string,
  webhookSecret: string,
  event: string,
  data: Record<string, unknown>
): Promise<WebhookResult> {
  const startTime = Date.now();

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, webhookSecret);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'User-Agent': 'DivinityCoin-Webhook/1.0',
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const durationMs = Date.now() - startTime;
    let responseBody = '';

    try {
      responseBody = await response.text();
    } catch {
      responseBody = '[Could not read response body]';
    }

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    };
  }
}

export async function sendTestWebhook(
  webhookUrl: string,
  webhookSecret: string
): Promise<WebhookResult> {
  return sendWebhook(webhookUrl, webhookSecret, 'test.ping', {
    message: 'This is a test webhook from DivinityCoin',
    test: true,
  });
}
