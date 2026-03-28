#!/usr/bin/env node

/**
 * Data Restore Script
 * 
 * This script restores data after the schema migration
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:Quick1501!@db.uznzmoulrdzyfpshnixx.supabase.co:5432/postgres"
    }
  }
});

async function restoreData() {
  console.log('🔄 Restoring data with new schema...');
  
  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync('backup-data.json', 'utf8'));
    
    console.log(`📦 Found backup from ${backupData.timestamp}`);
    console.log(`   Users: ${backupData.users.length}`);
    console.log(`   Stores: ${backupData.stores.length}`);
    console.log(`   Banks: ${backupData.banks.length}`);
    console.log(`   Vendors: ${backupData.vendors.length}`);
    console.log(`   Checks: ${backupData.checks.length}`);
    
    // Restore stores first
    console.log('🏪 Restoring stores...');
    for (const store of backupData.stores) {
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
    console.log('👤 Restoring users...');
    for (const user of backupData.users) {
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
    console.log('🏦 Restoring banks...');
    for (const bank of backupData.banks) {
      await prisma.bank.create({
        data: {
          id: bank.id,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber || 'temp-account',
          routingNumber: bank.routingNumber || 'temp-routing',
          accountType: 'CHECKING',
          storeId: bank.storeId || backupData.stores[0]?.id,
          balance: bank.balance || 0,
          isActive: true,
          createdAt: bank.createdAt,
          updatedAt: bank.updatedAt || new Date(),
        }
      });
    }
    
    // Restore vendors
    console.log('👥 Restoring vendors...');
    for (const vendor of backupData.vendors) {
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
          storeId: vendor.storeId || backupData.stores[0]?.id,
          isActive: true,
          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt || new Date(),
        }
      });
    }
    
    // Restore checks
    console.log('📝 Restoring checks...');
    for (const check of backupData.checks) {
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
    
    // Verify restoration
    const counts = {
      users: await prisma.user.count(),
      stores: await prisma.store.count(),
      banks: await prisma.bank.count(),
      vendors: await prisma.vendor.count(),
      checks: await prisma.check.count(),
    };
    
    console.log('\n📊 Final counts:');
    console.log(`   Users: ${counts.users}`);
    console.log(`   Stores: ${counts.stores}`);
    console.log(`   Banks: ${counts.banks}`);
    console.log(`   Vendors: ${counts.vendors}`);
    console.log(`   Checks: ${counts.checks}`);
    
  } catch (error) {
    console.error('❌ Error restoring data:', error);
    throw error;
  }
}

async function main() {
  console.log('🔄 Starting Data Restoration...');
  console.log('=' .repeat(40));
  
  try {
    await restoreData();
    console.log('\n✨ Data restoration complete!');
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}





