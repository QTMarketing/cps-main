#!/usr/bin/env node

/**
 * Supabase Environment Setup Script
 * This script helps set up environment variables for Supabase integration
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Supabase environment configuration...\n');

// Environment variables to set
const envVars = {
  // Database Configuration
  DATABASE_URL: 'postgresql://postgres:Quick1501!@db.uznzmoulrdzyfpshnixx.supabase.co:5432/postgres',
  DIRECT_URL: 'postgresql://postgres:Quick1501!@db.uznzmoulrdzyfpshnixx.supabase.co:5432/postgres',
  
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: 'https://uznzmoulrdzyfpshnixx.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnptb3VscmR6eWZwc2huaXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTM1MjQsImV4cCI6MjA3Njk2OTUyNH0.kxe7XV4IRQDuHLtYLuE2CUVbnsJlwK8kfso4tn8tbeI',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnptb3VscmR6eWZwc2huaXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM5MzUyNCwiZXhwIjoyMDc2OTY5NTI0fQ.WORItj1mWcCwkScAF7xxBiqMrjE0Uy-UAiZuu87hQxA',
  
  // Supabase Project Information
  SUPABASE_PROJECT_ID: 'uznzmoulrdzyfpshnixx',
  SUPABASE_PROJECT_NAME: 'chequeprinting',
  
  // Security Configuration
  JWT_SECRET: 'qt_office_jwt_secret_key_2024_secure_auth_token_generation',
  SESSION_SECRET: 'qt_office_session_secret_2024_secure_session_management',
  ENCRYPTION_KEY: 'qt_office_encryption_key_2024_32chars',
  
  // Application Configuration
  NODE_ENV: 'development',
  PORT: '3000',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  
  // File Upload Configuration
  MAX_FILE_SIZE: '10485760',
  ALLOWED_FILE_TYPES: 'pdf,jpg,jpeg,png,doc,docx',
  UPLOAD_DIR: './uploads',
  
  // Security Headers
  CSP_POLICY: 'default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\' data:;',
  
  // HTTPS Configuration
  FORCE_HTTPS: 'true',
  SSL_CERT_PATH: '/etc/ssl/certs/qt-office.crt',
  SSL_KEY_PATH: '/etc/ssl/private/qt-office.key',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  AUTH_RATE_LIMIT_WINDOW_MS: '900000',
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: '5',
  
  // Audit Logging
  AUDIT_LOGGING_ENABLED: 'true',
  AUDIT_LOG_RETENTION_DAYS: '365',
  
  // Re-authentication
  REAUTH_SESSION_DURATION_MINUTES: '5',
  LARGE_PAYMENT_THRESHOLD: '10000',
  
  // Email Configuration
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'noreply@qtoffice.com',
  EMAIL_TEMPLATE_PATH: './templates/email',
  
  // Logging Configuration
  LOG_LEVEL: 'info',
  LOG_FILE_PATH: './logs/app.log',
  CONSOLE_LOGGING: 'true',
  
  // Development Tools
  ENABLE_PRISMA_STUDIO: 'true',
  ENABLE_API_DOCS: 'true',
  DEBUG_MODE: 'true'
};

// Create .env.local file
const envContent = Object.entries(envVars)
  .map(([key, value]) => `${key}="${value}"`)
  .join('\n');

const envHeader = `# =============================================================================
# QT Office Check Printing System - Environment Configuration
# =============================================================================
# Generated on: ${new Date().toISOString()}
# 
# ⚠️  IMPORTANT SECURITY NOTES:
# 1. NEVER commit this file to version control
# 2. Use different keys for production environment
# 3. Rotate encryption keys regularly
# 4. Use environment-specific configurations
# 5. Monitor access logs regularly
# 6. Keep dependencies updated
# 7. Use HTTPS in production
# 8. Implement proper backup strategies
# =============================================================================

`;

const fullEnvContent = envHeader + envContent;

try {
  // Write to .env.local
  fs.writeFileSync('.env.local', fullEnvContent);
  console.log('✅ Created .env.local file with Supabase configuration');
  
  // Also create .env.example for reference
  const exampleContent = Object.entries(envVars)
    .map(([key, value]) => `${key}="your_${key.toLowerCase()}_here"`)
    .join('\n');
  
  const exampleHeader = `# =============================================================================
# QT Office Check Printing System - Environment Configuration Template
# =============================================================================
# Copy this file to .env.local and fill in your actual values
# =============================================================================

`;

  fs.writeFileSync('.env.example', exampleHeader + exampleContent);
  console.log('✅ Created .env.example template file');
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads', { recursive: true });
    console.log('✅ Created uploads directory');
  }
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
    console.log('✅ Created logs directory');
  }
  
  console.log('\n🎉 Supabase environment setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify .env.local file was created');
  console.log('2. Run: npm run db:generate (to generate Prisma client)');
  console.log('3. Run: npm run db:push (to sync schema with Supabase)');
  console.log('4. Test connection: npm run dev');
  console.log('\n🔗 Supabase Project Details:');
  console.log(`   Project: ${envVars.SUPABASE_PROJECT_NAME}`);
  console.log(`   Project ID: ${envVars.SUPABASE_PROJECT_ID}`);
  console.log(`   URL: ${envVars.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log('\n⚠️  Remember to never commit .env.local to version control!');
  
} catch (error) {
  console.error('❌ Error setting up environment:', error.message);
  process.exit(1);
}
