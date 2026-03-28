#!/usr/bin/env node

/**
 * Environment Setup Script for QT Office Check Printing System
 * 
 * This script helps you generate secure environment variables and set up
 * your .env.local file with proper values.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 QT Office Environment Setup');
console.log('==============================\n');

// Check if .env.local already exists
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('⚠️  .env.local already exists!');
  console.log('   This script will not overwrite existing files.');
  console.log('   If you want to regenerate secrets, please delete .env.local first.\n');
  process.exit(0);
}

// Generate secure secrets
console.log('🔑 Generating secure secrets...\n');

const encryptionKey = crypto.randomBytes(32).toString('hex');
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated secrets:');
console.log(`   ENCRYPTION_KEY: ${encryptionKey}`);
console.log(`   JWT_SECRET: ${jwtSecret}`);
console.log(`   SESSION_SECRET: ${sessionSecret}\n`);

// Create .env.local content
const envContent = `# QT Office Check Printing System - Local Environment Variables
# ============================================================
# 
# Generated on: ${new Date().toISOString()}
# 
# SECURITY WARNING:
# - This file is gitignored and should never be committed
# - Keep these secrets secure and rotate them regularly
# - Use different values for each environment

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# PostgreSQL Database Connection URL
# Replace with your actual PostgreSQL connection details
DATABASE_URL="postgresql://postgres:password@localhost:5432/qt_office"

# =============================================================================
# ENCRYPTION CONFIGURATION
# =============================================================================

# AES-256 Encryption Key for Sensitive Financial Data
# Generated: ${new Date().toISOString()}
ENCRYPTION_KEY="${encryptionKey}"

# =============================================================================
# AUTHENTICATION & SESSION CONFIGURATION
# =============================================================================

# JWT Secret for Authentication Tokens
# Generated: ${new Date().toISOString()}
JWT_SECRET="${jwtSecret}"

# Session Secret for Session Management
# Generated: ${new Date().toISOString()}
SESSION_SECRET="${sessionSecret}"

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================

# Node.js Environment
NODE_ENV="development"

# Server Port
PORT=3000

# Public Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# =============================================================================
# OPTIONAL CONFIGURATION
# =============================================================================

# Database Connection Pool Size
DATABASE_POOL_SIZE=10

# JWT Token Expiration Time
JWT_EXPIRES_IN="24h"

# Session Cookie Max Age (24 hours in milliseconds)
SESSION_MAX_AGE=86400000

# File Upload Configuration (10MB in bytes)
MAX_FILE_SIZE=10485760

# Rate Limiting (requests per minute)
RATE_LIMIT_MAX=100

# =============================================================================
# SECURITY NOTES
# =============================================================================
#
# 🔐 These secrets were generated using Node.js crypto.randomBytes()
# 🔐 Each secret is 64 characters (32 bytes) of cryptographically secure random data
# 🔐 Store these secrets securely and never commit them to version control
# 🔐 Rotate these secrets regularly in production environments
# 🔐 Use different secrets for each environment (dev, staging, prod)
#
# =============================================================================
`;

// Write .env.local file
try {
  fs.writeFileSync(envLocalPath, envContent);
  console.log('✅ Created .env.local file successfully!');
  console.log(`   Location: ${envLocalPath}\n`);
} catch (error) {
  console.error('❌ Failed to create .env.local file:', error.message);
  process.exit(1);
}

// Display next steps
console.log('📋 Next Steps:');
console.log('==============');
console.log('1. Update DATABASE_URL with your PostgreSQL credentials');
console.log('2. Ensure PostgreSQL is running and accessible');
console.log('3. Run database migrations: npx prisma migrate dev');
console.log('4. Start the application: npm run dev');
console.log('5. Visit http://localhost:3000 to access the application\n');

console.log('🔒 Security Reminders:');
console.log('======================');
console.log('• Never commit .env.local to version control');
console.log('• Keep these secrets secure and private');
console.log('• Rotate secrets regularly in production');
console.log('• Use different secrets for each environment');
console.log('• Store production secrets in a secure secret management system\n');

console.log('🎉 Environment setup complete!');
console.log('==============================');





