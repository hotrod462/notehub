import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES-GCM, IV is typically 12 bytes, but 16 provides compatibility
const AUTH_TAG_LENGTH = 16;

// Ensure the encryption key is the correct length (32 bytes for aes-256)
const encryptionKeyEnv = process.env.ENCRYPTION_KEY;
if (!encryptionKeyEnv) {
  throw new Error('ENCRYPTION_KEY environment variable is not set.');
}

// Convert URL-safe base64 key back to standard base64 if needed, then buffer
const base64Key = encryptionKeyEnv.replace(/\-/g, '+').replace(/_/g, '/');
const encryptionKey = Buffer.from(base64Key, 'base64');

if (encryptionKey.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte base64 encoded string.');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext The string to encrypt.
 * @returns A string containing iv, authTag, and ciphertext, colon-separated and base64 encoded.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return ''; // Handle null or empty string input gracefully
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV, authTag, and ciphertext into a single string for storage
  // Using base64url encoding (RFC 4648) for URL/filesystem safety
  const ivB64 = iv.toString('base64url');
  const authTagB64 = authTag.toString('base64url');
  const encryptedB64 = Buffer.from(encrypted, 'base64').toString('base64url');

  return `${ivB64}:${authTagB64}:${encryptedB64}`;
}

/**
 * Decrypts ciphertext encrypted with the encrypt function.
 * @param ciphertext The encrypted string (iv:authTag:ciphertext, base64 encoded).
 * @returns The original plaintext string, or null if decryption fails.
 */
export function decrypt(ciphertext: string): string | null {
  if (!ciphertext) {
    return null; // Cannot decrypt null or empty string
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      console.error('Invalid ciphertext format.');
      return null;
    }

    const [ivB64, authTagB64, encryptedB64] = parts;

    // Decode from base64url
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');
    const encrypted = Buffer.from(encryptedB64, 'base64url').toString('base64');

    // Check lengths to prevent potential issues
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        console.error('Invalid IV or authTag length during decryption.');
        return null;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null; // Return null on any decryption error
  }
} 