// lib/stripe.ts
// Stripe client - reads configuration from database with fallback to environment variables

import Stripe from 'stripe';
import { getStripeConfig } from '@/lib/config';

let _stripe: Stripe | null = null;
let _configuredKey: string | null = null;

/**
 * Get Stripe instance - loads config from database
 * Note: This is async, so use getStripeClient() for async contexts
 */
export async function getStripeClient(): Promise<Stripe> {
  const config = await getStripeConfig();
  const secretKey = config.secretKey;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Please configure Stripe settings in the admin panel.');
  }

  // Re-create client if key changed
  if (_stripe && _configuredKey === secretKey) {
    return _stripe;
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
  _configuredKey = secretKey;

  return _stripe;
}

/**
 * Lazy-loaded Stripe proxy for backwards compatibility
 * Falls back to env var for sync access (e.g., during build)
 */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      const envKey = process.env.STRIPE_SECRET_KEY;
      if (!envKey) {
        throw new Error('STRIPE_SECRET_KEY is not set. Use getStripeClient() for async access or configure in admin panel.');
      }
      _stripe = new Stripe(envKey, {
        apiVersion: '2023-10-16',
        typescript: true,
      });
      _configuredKey = envKey;
    }
    return (_stripe as unknown as Record<string, unknown>)[prop as string];
  },
});

/**
 * Get webhook secret from database
 */
export async function getWebhookSecret(): Promise<string> {
  const config = await getStripeConfig();
  return config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
}

/**
 * Clear cached Stripe instance (call after updating settings)
 */
export function clearStripeCache(): void {
  _stripe = null;
  _configuredKey = null;
}

export default stripe;
