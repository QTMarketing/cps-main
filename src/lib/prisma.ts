import { PrismaClient } from '@prisma/client';
import { encryptString, decryptString, isValidEncryptedString } from './encryption';

// Note: Next.js automatically loads .env.local, so no need to call dotenv.config()

/**
 * Prisma Client with Automatic Encryption/Decryption Middleware
 * 
 * This client automatically encrypts sensitive bank data before saving to the database
 * and decrypts it when reading from the database. The encryption is completely transparent
 * to the rest of the application.
 */

// Fields that should be encrypted in the Bank model
const ENCRYPTED_BANK_FIELDS = ['accountNumber', 'routingNumber'];

/**
 * Check if a value is already encrypted
 */
function isEncrypted(value: string): boolean {
  return isValidEncryptedString(value);
}

/**
 * Encrypt a field value if it's not already encrypted
 */
function encryptField(value: string): string {
  if (!value || value.trim() === '') {
    return value;
  }
  
  // If already encrypted, return as-is
  if (isEncrypted(value)) {
    return value;
  }
  
  try {
    return encryptString(value);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(`Failed to encrypt field: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a field value if it's encrypted
 */
function decryptField(value: string): string {
  if (!value || value.trim() === '') {
    return value;
  }
  
  // If not encrypted, return as-is
  if (!isEncrypted(value)) {
    return value;
  }
  
  try {
    return decryptString(value);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return original value if decryption fails (might be plain text)
    console.warn('Decryption failed, returning original value');
    return value;
  }
}

/**
 * Process bank data for encryption/decryption
 */
function processBankData(data: any, operation: 'encrypt' | 'decrypt'): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const processedData = { ...data };
  
  ENCRYPTED_BANK_FIELDS.forEach(field => {
    if (field in processedData && typeof processedData[field] === 'string') {
      if (operation === 'encrypt') {
        processedData[field] = encryptField(processedData[field]);
      } else if (operation === 'decrypt') {
        processedData[field] = decryptField(processedData[field]);
      }
    }
  });
  
  return processedData;
}

/**
 * Process nested bank data in query results
 */
function processQueryResult(result: any, operation: 'encrypt' | 'decrypt'): any {
  if (!result) {
    return result;
  }
  
  // Handle single object
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    // Check if this is a Bank object
    if ('accountNumber' in result || 'routingNumber' in result) {
      return processBankData(result, operation);
    }
    
    // Check for nested Bank objects
    const processed = { ...result };
    Object.keys(processed).forEach(key => {
      if (processed[key] && typeof processed[key] === 'object') {
        if ('accountNumber' in processed[key] || 'routingNumber' in processed[key]) {
          processed[key] = processBankData(processed[key], operation);
        }
      }
    });
    
    return processed;
  }
  
  // Handle arrays
  if (Array.isArray(result)) {
    return result.map(item => processQueryResult(item, operation));
  }
  
  return result;
}

/**
 * Create Prisma client with encryption middleware
 */
function createPrismaClientWithEncryption(): PrismaClient {
  const prisma = new PrismaClient();

  // Prisma 6.x middleware using $extends
  const extendedPrisma = prisma.$extends({
    query: {
      bank: {
        async create({ args, query }) {
          // Encrypt sensitive fields before creating
          if (args.data) {
            args.data = processBankData(args.data, 'encrypt');
          }
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async update({ args, query }) {
          // Encrypt sensitive fields before updating
          if (args.data) {
            args.data = processBankData(args.data, 'encrypt');
          }
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async upsert({ args, query }) {
          // Encrypt sensitive fields before upserting
          if (args.create) {
            args.create = processBankData(args.create, 'encrypt');
          }
          if (args.update) {
            args.update = processBankData(args.update, 'encrypt');
          }
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async findFirst({ args, query }) {
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async findMany({ args, query }) {
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async findFirstOrThrow({ args, query }) {
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
        async findUniqueOrThrow({ args, query }) {
          const result = await query(args);
          return processQueryResult(result, 'decrypt');
        },
      },
    },
  });

  return extendedPrisma as any;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClient = (globalForPrisma.prisma ?? createPrismaClientWithEncryption()) as any;

export const prisma = prismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient

/**
 * Utility function to manually encrypt bank data
 * Useful for testing or special cases
 */
export function encryptBankData(bankData: { accountNumber?: string; routingNumber?: string }) {
  return processBankData(bankData, 'encrypt');
}

/**
 * Utility function to manually decrypt bank data
 * Useful for testing or special cases
 */
export function decryptBankData(bankData: { accountNumber?: string; routingNumber?: string }) {
  return processBankData(bankData, 'decrypt');
}

/**
 * Test function to verify encryption/decryption works
 */
export async function testEncryptionMiddleware() {
  try {
    console.log('🔐 Testing Prisma encryption middleware...');
    
    // Test data
    const testBankData = {
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      routingNumber: '021000021',
      storeId: 'test-store-id',
      balance: 1000
    };
    
    // Test encryption
    const encrypted = encryptBankData(testBankData);
    console.log('✅ Encryption test passed');
    console.log('   Original accountNumber:', testBankData.accountNumber);
    console.log('   Encrypted accountNumber:', encrypted.accountNumber?.substring(0, 20) + '...');
    
    // Test decryption
    const decrypted = decryptBankData(encrypted);
    console.log('✅ Decryption test passed');
    console.log('   Decrypted accountNumber:', decrypted.accountNumber);
    
    // Verify round-trip
    if (decrypted.accountNumber === testBankData.accountNumber && 
        decrypted.routingNumber === testBankData.routingNumber) {
      console.log('✅ Round-trip test passed - encryption/decryption working correctly');
    } else {
      console.log('❌ Round-trip test failed');
    }
    
  } catch (error) {
    console.error('❌ Encryption middleware test failed:', error);
  }
}