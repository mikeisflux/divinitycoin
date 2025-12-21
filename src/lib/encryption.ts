// lib/encryption.ts
// Encryption utilities for sensitive data like API keys

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * In production, this should be a securely stored 256-bit key
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }

  // Derive a consistent key from the secret using PBKDF2
  // Using a fixed salt derived from the secret itself for deterministic key generation
  const salt = crypto.createHash('sha256').update(secret + '_salt').digest().slice(0, SALT_LENGTH);

  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive data
 * Returns base64-encoded string containing IV + encrypted data + auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString('base64');
}

/**
 * Decrypt encrypted data
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV, encrypted data, and auth tag
  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(-AUTH_TAG_LENGTH);
  const encrypted = combined.slice(IV_LENGTH, -AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(prefix: string = 'sk'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${randomPart}`;
}

/**
 * Hash an API key for storage (for lookup purposes)
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Mask an API key for display (show only first and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return '****';
  }
  const prefix = apiKey.slice(0, 7); // e.g., "sk_live"
  const suffix = apiKey.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Validate an API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Format: prefix_base64urlsafe (e.g., sk_live_abc123...)
  return /^[a-z]{2,8}_[A-Za-z0-9_-]{20,50}$/.test(apiKey);
}

/**
 * Encrypt environment variable value for storage
 */
export function encryptConfigValue(value: string): string {
  return encrypt(value);
}

/**
 * Decrypt environment variable value from storage
 */
export function decryptConfigValue(encryptedValue: string): string {
  try {
    return decrypt(encryptedValue);
  } catch (error) {
    console.error('Failed to decrypt config value:', error);
    throw new Error('Failed to decrypt configuration value');
  }
}
