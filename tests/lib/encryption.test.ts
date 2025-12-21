import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('API Key Encryption', () => {
  const ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
  const ALGORITHM = 'aes-256-gcm';

  const encrypt = (text: string, key: string): string => {
    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  };

  const decrypt = (encryptedText: string, key: string): string => {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  };

  it('should encrypt and decrypt API keys correctly', () => {
    const originalKey = 'pk_live_abc123xyz789';
    const encrypted = encrypt(originalKey, ENCRYPTION_KEY);
    const decrypted = decrypt(encrypted, ENCRYPTION_KEY);

    expect(decrypted).toBe(originalKey);
  });

  it('should produce different encrypted values for same input', () => {
    const originalKey = 'sk_test_secretkey123';
    const encrypted1 = encrypt(originalKey, ENCRYPTION_KEY);
    const encrypted2 = encrypt(originalKey, ENCRYPTION_KEY);

    // Due to random IV, encryptions should differ
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decrypt(encrypted1, ENCRYPTION_KEY)).toBe(originalKey);
    expect(decrypt(encrypted2, ENCRYPTION_KEY)).toBe(originalKey);
  });

  it('should fail with wrong encryption key', () => {
    const originalKey = 'api_key_12345';
    const encrypted = encrypt(originalKey, ENCRYPTION_KEY);

    expect(() => {
      decrypt(encrypted, 'wrong-key-here-totally-different');
    }).toThrow();
  });

  it('should handle special characters in API keys', () => {
    const specialKey = 'pk_live_!@#$%^&*()_+-=[]{}|;:,.<>?';
    const encrypted = encrypt(specialKey, ENCRYPTION_KEY);
    const decrypted = decrypt(encrypted, ENCRYPTION_KEY);

    expect(decrypted).toBe(specialKey);
  });

  it('should handle long API keys', () => {
    const longKey = 'sk_live_' + 'a'.repeat(500);
    const encrypted = encrypt(longKey, ENCRYPTION_KEY);
    const decrypted = decrypt(encrypted, ENCRYPTION_KEY);

    expect(decrypted).toBe(longKey);
  });
});

describe('API Key Generation', () => {
  const generateApiKey = (prefix: string): string => {
    const randomBytes = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${randomBytes}`;
  };

  it('should generate keys with correct prefix', () => {
    const publicKey = generateApiKey('pk_live');
    const secretKey = generateApiKey('sk_live');
    const testKey = generateApiKey('pk_test');

    expect(publicKey.startsWith('pk_live_')).toBe(true);
    expect(secretKey.startsWith('sk_live_')).toBe(true);
    expect(testKey.startsWith('pk_test_')).toBe(true);
  });

  it('should generate unique keys', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey('pk_live'));
    }
    expect(keys.size).toBe(100);
  });

  it('should generate keys of consistent length', () => {
    const key1 = generateApiKey('pk_live');
    const key2 = generateApiKey('pk_live');
    const key3 = generateApiKey('pk_live');

    // base64url of 24 bytes = 32 chars, plus prefix
    expect(key1.length).toBe(key2.length);
    expect(key2.length).toBe(key3.length);
  });
});

describe('Hash Functions', () => {
  const hashApiKey = (key: string): string => {
    return crypto.createHash('sha256').update(key).digest('hex');
  };

  it('should produce consistent hashes', () => {
    const key = 'pk_live_test123';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different keys', () => {
    const hash1 = hashApiKey('pk_live_key1');
    const hash2 = hashApiKey('pk_live_key2');

    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64 character hex hashes', () => {
    const hash = hashApiKey('any_key_here');
    expect(hash.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });
});
