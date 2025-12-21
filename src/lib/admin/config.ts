// lib/admin/config.ts
// System configuration management with encrypted storage

import { prisma } from '@/lib/db';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

// Keys that should be encrypted in the database
const ENCRYPTED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'SENDGRID_WEBHOOK_SECRET',
  'INTERNAL_API_KEY',
  'ADMIN_SESSION_SECRET',
  'ENCRYPTION_SECRET',
];

// Keys that should never be exposed to the client
const SENSITIVE_KEYS = [
  ...ENCRYPTED_KEYS,
  'DATABASE_URL',
  'ADMIN_INITIAL_PASSWORD',
];

export interface ConfigValue {
  key: string;
  value: string;
  isEncrypted: boolean;
  isSecret: boolean;
  updatedAt: Date;
  updatedBy?: string;
}

export interface ConfigValueForClient {
  key: string;
  value: string; // Masked for secrets
  isSecret: boolean;
  updatedAt: string;
  hasValue: boolean;
}

/**
 * Get a configuration value from the database
 */
export async function getConfig(key: string): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key },
  });

  if (!config) {
    return null;
  }

  // Decrypt if the value is encrypted
  if (config.isEncrypted) {
    try {
      return decrypt(config.value);
    } catch (error) {
      console.error(`Failed to decrypt config ${key}:`, error);
      return null;
    }
  }

  return config.value;
}

/**
 * Set a configuration value in the database
 */
export async function setConfig(
  key: string,
  value: string,
  adminId?: string
): Promise<void> {
  const shouldEncrypt = ENCRYPTED_KEYS.includes(key);
  const storedValue = shouldEncrypt ? encrypt(value) : value;

  await prisma.systemConfig.upsert({
    where: { key },
    update: {
      value: storedValue,
      isEncrypted: shouldEncrypt,
      updatedAt: new Date(),
      updatedBy: adminId,
    },
    create: {
      key,
      value: storedValue,
      isEncrypted: shouldEncrypt,
      updatedBy: adminId,
    },
  });
}

/**
 * Delete a configuration value
 */
export async function deleteConfig(key: string): Promise<void> {
  await prisma.systemConfig.delete({
    where: { key },
  }).catch(() => {
    // Ignore if not found
  });
}

/**
 * Get all configuration values (for admin display)
 * Sensitive values are masked
 */
export async function getAllConfigs(): Promise<ConfigValueForClient[]> {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: 'asc' },
  });

  return configs.map(config => {
    const isSecret = SENSITIVE_KEYS.includes(config.key);
    let displayValue = '';

    if (isSecret) {
      // For secrets, show masked value
      if (config.value) {
        try {
          const decrypted = config.isEncrypted ? decrypt(config.value) : config.value;
          displayValue = maskApiKey(decrypted);
        } catch {
          displayValue = '****';
        }
      }
    } else {
      displayValue = config.isEncrypted ? decrypt(config.value) : config.value;
    }

    return {
      key: config.key,
      value: displayValue,
      isSecret,
      updatedAt: config.updatedAt.toISOString(),
      hasValue: !!config.value,
    };
  });
}

/**
 * Get configs grouped by category for admin UI
 */
export async function getConfigsByCategory(): Promise<Record<string, ConfigValueForClient[]>> {
  const allConfigs = await getAllConfigs();

  const categories: Record<string, string[]> = {
    stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
    sendgrid: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'SENDGRID_FROM_NAME', 'SENDGRID_WEBHOOK_SECRET'],
    security: ['INTERNAL_API_KEY', 'ADMIN_SESSION_SECRET', 'ENCRYPTION_SECRET'],
    rateLimit: ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_ATTEMPTS'],
    general: ['NEXT_PUBLIC_BASE_URL'],
  };

  const result: Record<string, ConfigValueForClient[]> = {};

  for (const [category, keys] of Object.entries(categories)) {
    result[category] = allConfigs.filter(c => keys.includes(c.key));
  }

  // Add any uncategorized configs
  const allCategorizedKeys = Object.values(categories).flat();
  const uncategorized = allConfigs.filter(c => !allCategorizedKeys.includes(c.key));
  if (uncategorized.length > 0) {
    result.other = uncategorized;
  }

  return result;
}

/**
 * Validate required configs are set
 */
export async function validateRequiredConfigs(): Promise<{ valid: boolean; missing: string[] }> {
  const requiredKeys = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL',
  ];

  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = await getConfig(key);
    if (!value) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Sync environment variables to database on startup
 * Only creates entries that don't already exist
 */
export async function syncEnvToDatabase(): Promise<void> {
  const envKeys = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL',
    'SENDGRID_FROM_NAME',
    'SENDGRID_WEBHOOK_SECRET',
    'INTERNAL_API_KEY',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_ATTEMPTS',
    'NEXT_PUBLIC_BASE_URL',
  ];

  for (const key of envKeys) {
    const envValue = process.env[key];
    if (envValue) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!existing) {
        await setConfig(key, envValue);
      }
    }
  }
}
