import * as crypto from 'crypto';

/**
 * Encryption utility for sensitive financial data using AES-256-GCM
 * 
 * This module provides secure encryption and decryption functions for sensitive data
 * like bank account numbers, routing numbers, and other financial information.
 * 
 * Security Features:
 * - AES-256-GCM encryption (Galois/Counter Mode)
 * - Random IV (Initialization Vector) for each encryption
 * - PBKDF2 key derivation with salt
 * - Authentication tag for data integrity
 * - Secure random number generation
 */

// TypeScript interfaces for type safety
interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
  tag: string;
}

interface DecryptionResult {
  decrypted: string;
  success: boolean;
  error?: string;
}

/**
 * Configuration constants for encryption
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment variables
 * @returns {string} The encryption key
 * @throws {Error} If encryption key is not found or invalid
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  return key;
}

/**
 * Derive encryption key using PBKDF2
 * @param {string} password - The base password/key
 * @param {Buffer} salt - Random salt for key derivation
 * @returns {Buffer} Derived encryption key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  try {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  } catch (error) {
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt sensitive text data using AES-256-GCM
 * 
 * How it works:
 * 1. Generate a random salt and IV (Initialization Vector)
 * 2. Derive encryption key from password + salt using PBKDF2
 * 3. Create cipher with AES-256-GCM algorithm
 * 4. Encrypt the data and generate authentication tag
 * 5. Return encrypted data with metadata (IV, salt, tag)
 * 
 * @param {string} text - The sensitive text to encrypt
 * @returns {EncryptionResult} Object containing encrypted data and metadata
 * @throws {Error} If encryption fails or input is invalid
 */
export function encrypt(text: string): EncryptionResult {
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Input text must be a non-empty string');
    }
    
    if (text.length === 0) {
      throw new Error('Cannot encrypt empty string');
    }
    
    // Get encryption key from environment
    const password = getEncryptionKey();
    
    // Generate random salt and IV for this encryption
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive encryption key from password and salt
    const key = deriveKey(password, salt);
    
    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Return encrypted data with metadata
    return {
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      tag: tag.toString('hex')
    };
    
  } catch (error) {
    // Comprehensive error handling
    if (error instanceof Error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
    throw new Error('Encryption failed: Unknown error occurred');
  }
}

/**
 * Decrypt encrypted text data using AES-256-GCM
 * 
 * How it works:
 * 1. Parse the encrypted data and metadata (IV, salt, tag)
 * 2. Derive the same encryption key using password + salt
 * 3. Create decipher with AES-256-GCM algorithm
 * 4. Set authentication tag and IV
 * 5. Decrypt and verify data integrity
 * 6. Return decrypted text
 * 
 * @param {EncryptionResult} encryptedData - The encrypted data with metadata
 * @returns {DecryptionResult} Object containing decrypted text and success status
 */
export function decrypt(encryptedData: EncryptionResult): DecryptionResult {
  try {
    // Input validation
    if (!encryptedData || typeof encryptedData !== 'object') {
      return {
        decrypted: '',
        success: false,
        error: 'Invalid encrypted data format'
      };
    }
    
    const { encrypted, iv, salt, tag } = encryptedData;
    
    if (!encrypted || !iv || !salt || !tag) {
      return {
        decrypted: '',
        success: false,
        error: 'Missing required encryption metadata'
      };
    }
    
    // Validate hex strings
    const hexRegex = /^[0-9a-f]+$/i;
    if (!hexRegex.test(encrypted) || !hexRegex.test(iv) || !hexRegex.test(salt) || !hexRegex.test(tag)) {
      return {
        decrypted: '',
        success: false,
        error: 'Invalid hex format in encrypted data'
      };
    }
    
    // Get encryption key from environment
    const password = getEncryptionKey();
    
    // Convert hex strings back to buffers
    const saltBuffer = Buffer.from(salt, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const tagBuffer = Buffer.from(tag, 'hex');
    
    // Derive the same encryption key
    const key = deriveKey(password, saltBuffer);
    
    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return {
      decrypted,
      success: true
    };
    
  } catch (error) {
    // Comprehensive error handling
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      decrypted: '',
      success: false,
      error: `Decryption failed: ${errorMessage}`
    };
  }
}

/**
 * Encrypt a simple string (convenience function)
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted string in base64 format
 */
export function encryptString(text: string): string {
  try {
    const result = encrypt(text);
    // Combine all data into a single base64 string for easy storage
    const combined = JSON.stringify({
      e: result.encrypted,
      i: result.iv,
      s: result.salt,
      t: result.tag
    });
    return Buffer.from(combined).toString('base64');
  } catch (error) {
    throw new Error(`String encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a simple string (convenience function)
 * @param {string} encryptedString - Base64 encrypted string
 * @returns {string} Decrypted text
 */
export function decryptString(encryptedString: string): string {
  try {
    // Parse the base64 string back to JSON
    const combined = Buffer.from(encryptedString, 'base64').toString('utf8');
    const data = JSON.parse(combined);
    
    const result = decrypt({
      encrypted: data.e,
      iv: data.i,
      salt: data.s,
      tag: data.t
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Decryption failed');
    }
    
    return result.decrypted;
  } catch (error) {
    throw new Error(`String decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a secure random encryption key
 * @param {number} length - Length of the key (default: 64)
 * @returns {string} Random hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(length: number = 64): string {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    throw new Error(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate if a string is properly encrypted
 * @param {string} encryptedString - The encrypted string to validate
 * @returns {boolean} True if the string appears to be properly encrypted
 */
export function isValidEncryptedString(encryptedString: string): boolean {
  try {
    if (!encryptedString || typeof encryptedString !== 'string') {
      return false;
    }
    
    // Try to decode and parse
    const combined = Buffer.from(encryptedString, 'base64').toString('utf8');
    const data = JSON.parse(combined);
    
    // Check if all required fields exist
    return !!(data.e && data.i && data.s && data.t);
  } catch {
    return false;
  }
}
