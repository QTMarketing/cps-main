#!/usr/bin/env node

/**
 * Create Default Admin User Script
 * This script creates a default admin user for development
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createDefaultAdmin() {
  try {
    console.log('🔧 Creating default admin user...');

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@quicktrackinc.com' },
          { username: 'admin' }
        ]
      }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      
      // Update password to known value
      const hashedPassword = await bcrypt.hash('admin1234', 12);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { passwordHash: hashedPassword }
      });
      console.log('✅ Admin password updated to: admin1234');
      return;
    }

    // Get the first store
    const store = await prisma.store.findFirst();
    if (!store) {
      console.log('❌ No store found. Please create a store first.');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin1234', 12);
    const adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@quicktrackinc.com',
        passwordHash: hashedPassword,
        role: 'ADMIN',
        storeId: store.id,
        isActive: true
      }
    });

    console.log('✅ Default admin user created successfully!');
    console.log('📧 Email: admin@quicktrackinc.com');
    console.log('🔑 Password: admin1234');
    console.log('👤 Role: ADMIN');
    console.log('🏪 Store:', store.name);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultAdmin();


