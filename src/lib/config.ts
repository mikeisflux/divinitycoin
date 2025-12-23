// lib/config.ts
// Configuration loader - reads from database with fallback to environment variables

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

// Cache for config values to avoid repeated DB calls
let configCache: Map<string, string> | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Load all config values from database
 */
async function loadConfigFromDatabase(): Promise<Map<string, string>> {
  const configs = await prisma.systemConfig.findMany();
  const configMap = new Map<string, string>();

  for (const config of configs) {
    try {
      // Decrypt encrypted values
      if (config.isEncrypted) {
        configMap.set(config.key, decrypt(config.value));
      } else {
        configMap.set(config.key, config.value);
      }
    } catch (error) {
      logger.error('Failed to process config', { key: config.key, error });
    }
  }

  return configMap;
}

/**
 * Get a config value - checks database first, then falls back to environment variable
 */
export async function getConfig(key: string, defaultValue: string = ''): Promise<string> {
  // Check if cache is valid
  const now = Date.now();
  if (!configCache || now > cacheExpiry) {
    try {
      configCache = await loadConfigFromDatabase();
      cacheExpiry = now + CACHE_TTL;
    } catch (error) {
      logger.error('Failed to load config from database', { error });
      configCache = new Map();
    }
  }

  // Check database config first
  if (configCache.has(key)) {
    return configCache.get(key)!;
  }

  // Fall back to environment variable
  return process.env[key] || defaultValue;
}

/**
 * Get multiple config values at once
 */
export async function getConfigs(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const key of keys) {
    result[key] = await getConfig(key);
  }

  return result;
}

/**
 * Clear the config cache (call after updating settings)
 */
export function clearConfigCache(): void {
  configCache = null;
  cacheExpiry = 0;
}

/**
 * Get SMTP configuration
 */
export async function getSmtpConfig() {
  return {
    host: await getConfig('SMTP_HOST', 'smtp.office365.com'),
    port: parseInt(await getConfig('SMTP_PORT', '587'), 10),
    secure: (await getConfig('SMTP_SECURE', 'false')) === 'true',
    user: await getConfig('SMTP_USER', ''),
    pass: await getConfig('SMTP_PASS', ''),
    fromEmail: await getConfig('SMTP_FROM_EMAIL', ''),
    fromName: await getConfig('SMTP_FROM_NAME', 'DivinityCoin'),
    replyTo: await getConfig('SMTP_REPLY_TO', ''),
  };
}

/**
 * Get Stripe configuration
 * Note: Uses same key names as /admin/settings/api page
 */
export async function getStripeConfig() {
  return {
    secretKey: await getConfig('STRIPE_SECRET_KEY', ''),
    publishableKey: await getConfig('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', ''),
    webhookSecret: await getConfig('STRIPE_WEBHOOK_SECRET', ''),
  };
}
