#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * 
 * This script helps configure the QT Office Check Printing System
 * to use Supabase as the database provider.
 */

const fs = require('fs');
const path = require('path');

// Supabase database configuration
const SUPABASE_CONFIG = {
  DATABASE_URL: "postgresql://postgres:Quick1501!@db.uznzmoulrdzyfpshnixx.supabase.co:5432/postgres",
  DB_HOST: "db.uznzmoulrdzyfpshnixx.supabase.co",
  DB_PORT: "5432",
  DB_USERNAME: "postgres",
  DB_PASSWORD: "Quick1501!",
  DB_NAME: "postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://uznzmoulrdzyfpshnixx.supabase.co"
};

// Environment template
const ENV_TEMPLATE = `# QT Office Check Printing System - Supabase Database Configuration
# Database: chequeprinting
# Provider: Supabase

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# Supabase PostgreSQL Connection String
DATABASE_URL="${SUPABASE_CONFIG.DATABASE_URL}"

# Alternative connection parameters (for reference)
DB_HOST="${SUPABASE_CONFIG.DB_HOST}"
DB_PORT="${SUPABASE_CONFIG.DB_PORT}"
DB_USERNAME="${SUPABASE_CONFIG.DB_USERNAME}"
DB_PASSWORD="${SUPABASE_CONFIG.DB_PASSWORD}"
DB_NAME="${SUPABASE_CONFIG.DB_NAME}"

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

# JWT Secret for authentication tokens (generate a strong secret)
JWT_SECRET="qt-office-supabase-jwt-secret-key-2024-very-secure-random-string"

# Session secret for session management
SESSION_SECRET="qt-office-session-secret-supabase-2024-secure-random"

# Encryption key for sensitive data (generate a strong 32-character key)
# Use: openssl rand -base64 32
ENCRYPTION_KEY="qt-office-encryption-key-32-characters-long"

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================

# Environment
NODE_ENV="development"

# Server port
PORT="3000"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# =============================================================================
# SUPABASE CONFIGURATION (if using Supabase client)
# =============================================================================

# Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_CONFIG.NEXT_PUBLIC_SUPABASE_URL}"

# Supabase Anon Key (if using Supabase client)
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key-here"

# Supabase Service Role Key (if using Supabase client)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key-here"

# =============================================================================
# FILE UPLOAD CONFIGURATION
# =============================================================================

# Maximum file size (in bytes) - 10MB
MAX_FILE_SIZE="10485760"

# Allowed file types
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Upload directory
UPLOAD_DIR="./uploads"

# =============================================================================
# SECURITY SETTINGS
# =============================================================================

# Rate limiting
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="900000"

# CORS allowed origins
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Password requirements
MIN_PASSWORD_LENGTH="8"
REQUIRE_STRONG_PASSWORD="true"

# =============================================================================
# AUDIT LOGGING
# =============================================================================

# Audit log retention (in days)
AUDIT_LOG_RETENTION_DAYS="365"

# Enable audit logging
ENABLE_AUDIT_LOGGING="true"

# =============================================================================
# RE-AUTHENTICATION
# =============================================================================

# Re-authentication session duration (in minutes)
REAUTH_SESSION_DURATION="5"

# Large payment threshold (in dollars)
LARGE_PAYMENT_THRESHOLD="10000"

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================

# Enable debug logging
DEBUG="true"

# Enable API validation logging
LOG_VALIDATION_ERRORS="true"

# Enable security event logging
LOG_SECURITY_EVENTS="true"
`;

// Example environment template
const ENV_EXAMPLE_TEMPLATE = `# QT Office Check Printing System - Environment Variables Template
# Copy this file to .env.local and update with your actual values

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# Supabase PostgreSQL Connection String
# Format: postgresql://username:password@host:port/database
DATABASE_URL="postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres"

# Alternative connection parameters (for reference)
DB_HOST="db.your-project-ref.supabase.co"
DB_PORT="5432"
DB_USERNAME="postgres"
DB_PASSWORD="your_password"
DB_NAME="postgres"

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

# JWT Secret for authentication tokens
# Generate a strong secret: openssl rand -base64 32
JWT_SECRET="your-jwt-secret-key-here"

# Session secret for session management
# Generate a strong secret: openssl rand -base64 32
SESSION_SECRET="your-session-secret-here"

# Encryption key for sensitive data (must be exactly 32 characters)
# Generate: openssl rand -base64 32
ENCRYPTION_KEY="your-32-character-encryption-key"

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================

# Environment (development, production, test)
NODE_ENV="development"

# Server port
PORT="3000"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# =============================================================================
# SUPABASE CONFIGURATION (if using Supabase client)
# =============================================================================

# Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"

# Supabase Anon Key (if using Supabase client)
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Supabase Service Role Key (if using Supabase client)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# =============================================================================
# FILE UPLOAD CONFIGURATION
# =============================================================================

# Maximum file size (in bytes) - 10MB default
MAX_FILE_SIZE="10485760"

# Allowed file types (comma-separated)
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Upload directory
UPLOAD_DIR="./uploads"

# =============================================================================
# SECURITY SETTINGS
# =============================================================================

# Rate limiting
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="900000"

# CORS allowed origins (comma-separated)
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Password requirements
MIN_PASSWORD_LENGTH="8"
REQUIRE_STRONG_PASSWORD="true"

# =============================================================================
# AUDIT LOGGING
# =============================================================================

# Audit log retention (in days)
AUDIT_LOG_RETENTION_DAYS="365"

# Enable audit logging
ENABLE_AUDIT_LOGGING="true"

# =============================================================================
# RE-AUTHENTICATION
# =============================================================================

# Re-authentication session duration (in minutes)
REAUTH_SESSION_DURATION="5"

# Large payment threshold (in dollars)
LARGE_PAYMENT_THRESHOLD="10000"

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================

# Enable debug logging
DEBUG="true"

# Enable API validation logging
LOG_VALIDATION_ERRORS="true"

# Enable security event logging
LOG_SECURITY_EVENTS="true"
`;

function createEnvironmentFiles() {
  console.log('🚀 Setting up Supabase database configuration...\n');

  // Create .env.local file
  try {
    fs.writeFileSync('.env.local', ENV_TEMPLATE);
    console.log('✅ Created .env.local with Supabase configuration');
  } catch (error) {
    console.log('⚠️  Could not create .env.local (may be gitignored)');
    console.log('   Please create .env.local manually with the following content:');
    console.log('   ' + '='.repeat(50));
    console.log(ENV_TEMPLATE);
    console.log('   ' + '='.repeat(50));
  }

  // Create .env.example file
  try {
    fs.writeFileSync('.env.example', ENV_EXAMPLE_TEMPLATE);
    console.log('✅ Created .env.example template');
  } catch (error) {
    console.log('⚠️  Could not create .env.example');
  }

  console.log('\n📋 Next steps:');
  console.log('1. Copy .env.local content to your actual .env.local file');
  console.log('2. Run: npm run db:generate');
  console.log('3. Run: npm run db:push');
  console.log('4. Run: npm run dev');
  console.log('\n🔐 Security Note:');
  console.log('   Generate new secrets for production:');
  console.log('   - JWT_SECRET: openssl rand -base64 32');
  console.log('   - SESSION_SECRET: openssl rand -base64 32');
  console.log('   - ENCRYPTION_KEY: openssl rand -base64 32');
}

function testDatabaseConnection() {
  console.log('\n🔍 Testing database connection...');
  
  // This would require the Prisma client to be generated first
  console.log('   Run "npm run db:generate" first, then "npm run db:push"');
  console.log('   to test the database connection.');
}

function main() {
  console.log('🏦 QT Office Check Printing System - Supabase Setup');
  console.log('=' .repeat(60));
  
  createEnvironmentFiles();
  testDatabaseConnection();
  
  console.log('\n✨ Supabase setup complete!');
  console.log('   Database: chequeprinting');
  console.log('   Host: db.uznzmoulrdzyfpshnixx.supabase.co');
  console.log('   Port: 5432');
}

if (require.main === module) {
  main();
}

module.exports = {
  SUPABASE_CONFIG,
  ENV_TEMPLATE,
  ENV_EXAMPLE_TEMPLATE,
  createEnvironmentFiles,
  testDatabaseConnection
};





