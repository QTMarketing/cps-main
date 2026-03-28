#!/usr/bin/env node

/**
 * Prisma Schema Migration Script
 * 
 * This script handles the migration from the old schema to the new improved schema
 * with proper field mappings and enums.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:Quick1501!@db.uznzmoulrdzyfpshnixx.supabase.co:5432/postgres"
    }
  }
});

async function backupData() {
  console.log('📦 Backing up existing data...');
  
  try {
    // Backup existing data
    const users = await prisma.user.findMany();
    const stores = await prisma.store.findMany();
    const banks = await prisma.bank.findMany();
    const vendors = await prisma.vendor.findMany();
    const checks = await prisma.check.findMany();
    
    const backup = {
      users,
      stores,
      banks,
      vendors,
      checks,
      timestamp: new Date().toISOString()
    };
    
    // Save backup to file
    const fs = require('fs');
    fs.writeFileSync('backup-data.json', JSON.stringify(backup, null, 2));
    
    console.log('✅ Data backed up to backup-data.json');
    console.log(`   Users: ${users.length}`);
    console.log(`   Stores: ${stores.length}`);
    console.log(`   Banks: ${banks.length}`);
    console.log(`   Vendors: ${vendors.length}`);
    console.log(`   Checks: ${checks.length}`);
    
    return backup;
  } catch (error) {
    console.error('❌ Error backing up data:', error);
    throw error;
  }
}

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  
  try {
    // Clear data in correct order (respecting foreign keys)
    await prisma.check.deleteMany();
    await prisma.bank.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.user.deleteMany();
    await prisma.store.deleteMany();
    
    console.log('✅ Database cleared');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

async function restoreData(backup) {
  console.log('🔄 Restoring data with new schema...');
  
  try {
    // Restore stores first
    for (const store of backup.stores) {
      await prisma.store.create({
        data: {
          id: store.id,
          name: store.name,
          address: store.address || null,
          phone: store.phone || null,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt || new Date(),
        }
      });
    }
    
    // Restore users
    for (const user of backup.users) {
      await prisma.user.create({
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          passwordHash: user.password || user.passwordHash || 'temp-password',
          role: user.role || 'USER',
          storeId: user.storeId || null,
          isActive: true,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt || new Date(),
        }
      });
    }
    
    // Restore banks
    for (const bank of backup.banks) {
      await prisma.bank.create({
        data: {
          id: bank.id,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber || 'temp-account',
          routingNumber: bank.routingNumber || 'temp-routing',
          accountType: 'CHECKING',
          storeId: bank.storeId || backup.stores[0]?.id,
          balance: bank.balance || 0,
          isActive: true,
          createdAt: bank.createdAt,
          updatedAt: bank.updatedAt || new Date(),
        }
      });
    }
    
    // Restore vendors
    for (const vendor of backup.vendors) {
      await prisma.vendor.create({
        data: {
          id: vendor.id,
          vendorName: vendor.vendorName,
          vendorType: vendor.vendorType || 'MERCHANDISE',
          description: vendor.description || null,
          contactPerson: null,
          email: null,
          phone: null,
          address: null,
          storeId: vendor.storeId || backup.stores[0]?.id,
          isActive: true,
          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt || new Date(),
        }
      });
    }
    
    // Restore checks
    for (const check of backup.checks) {
      await prisma.check.create({
        data: {
          id: check.id,
          checkNumber: check.checkNumber,
          paymentMethod: check.paymentMethod || 'CHECK',
          bankId: check.bankId,
          vendorId: check.vendorId,
          payeeName: check.payeeName || 'Unknown Payee',
          amount: check.amount || 0,
          memo: check.memo || null,
          status: check.status || 'ISSUED',
          invoiceUrl: null,
          issuedBy: check.issuedBy,
          issuedAt: check.createdAt,
          clearedAt: null,
          voidedAt: null,
          voidReason: null,
          createdAt: check.createdAt,
          updatedAt: check.updatedAt || new Date(),
        }
      });
    }
    
    console.log('✅ Data restored successfully');
  } catch (error) {
    console.error('❌ Error restoring data:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Prisma Schema Migration...');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Backup existing data
    const backup = await backupData();
    
    // Step 2: Clear database
    await clearDatabase();
    
    // Step 3: Apply new schema (this will be done by prisma db push)
    console.log('📋 Next steps:');
    console.log('1. Run: npx prisma db push');
    console.log('2. Run: npm run db:generate');
    console.log('3. Run: node scripts/restore-data.js');
    
    console.log('\n✨ Migration preparation complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { backupData, clearDatabase, restoreData };





