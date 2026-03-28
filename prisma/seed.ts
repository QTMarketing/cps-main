/**
 * Database Seed Script
 * 
 * MINIMAL SEED: Only creates ONE SUPER_ADMIN user
 * No stores, banks, checks, or vendors
 * 
 * This script is designed for a fresh start.
 */

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting minimal database seed...');
  console.log('   Strategy: SUPER_ADMIN only, no demo data\n');

  // ============================================================================
  // SEED ONLY SUPER_ADMIN USER
  // ============================================================================
  console.log('👤 Creating SUPER_ADMIN user...');
  
  const password = 'ChangeMe123!';
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin@quicktrackinc.com' },
    update: {
      password_hash: hashedPassword,
      role: Role.SUPER_ADMIN,
      store_id: null, // SUPER_ADMIN has no store assignment
    },
    create: {
      username: 'admin@quicktrackinc.com',
      password_hash: hashedPassword,
      role: Role.SUPER_ADMIN,
      store_id: null, // SUPER_ADMIN has no store assignment
    },
  });

  console.log('✅ SUPER_ADMIN user created successfully');
  console.log(`   - Username: ${adminUser.username}`);
  console.log(`   - Role: ${adminUser.role}`);
  console.log(`   - ID: ${adminUser.id}`);
  console.log(`   - Store: ${adminUser.store_id === null ? 'None (SUPER_ADMIN)' : adminUser.store_id}`);

  // ============================================================================
  // VERIFICATION
  // ============================================================================
  console.log('\n📊 Verifying database state...');
  
  const userCount = await prisma.user.count();
  const storeCount = await prisma.store.count();
  const bankCount = await prisma.bank.count();
  const checkCount = await prisma.check.count();
  const vendorCount = await prisma.vendor.count();

  console.log(`   - Users: ${userCount}`);
  console.log(`   - Stores: ${storeCount}`);
  console.log(`   - Banks: ${bankCount}`);
  console.log(`   - Checks: ${checkCount}`);
  console.log(`   - Vendors: ${vendorCount}`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n✅ Seed completed successfully!');
  console.log('\n🔐 Login credentials:');
  console.log('   Username: admin@quicktrackinc.com');
  console.log('   Password: ChangeMe123!');
  console.log('\n💡 Next steps:');
  console.log('   1. Login with the credentials above');
  console.log('   2. Create stores via admin interface');
  console.log('   3. Create banks and assign to stores');
  console.log('   4. Create USER/ADMIN accounts and assign to stores');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

