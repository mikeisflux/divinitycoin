// lib/giftcard/generate.ts

import crypto from 'crypto';

/**
 * Generate a cryptographically secure 16-character hex code
 */
export function generateGiftCardCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Format code for display (XXXX-XXXX-XXXX-XXXX)
 */
export function formatCodeForDisplay(code: string): string {
  const cleaned = code.replace(/-/g, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join('-') || cleaned;
}

/**
 * Hash code using SHA-256 for secure storage
 */
export function hashCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Get last 4 characters for safe display
 */
export function getCodeLast4(code: string): string {
  const cleaned = code.replace(/-/g, '').toUpperCase();
  return cleaned.slice(-4);
}

/**
 * Validate code format (16 hex characters)
 */
export function isValidCodeFormat(code: string): boolean {
  const cleaned = code.replace(/-/g, '').toUpperCase();
  return /^[A-F0-9]{16}$/.test(cleaned);
}

/**
 * Normalize code input (remove dashes, uppercase)
 */
export function normalizeCode(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}
