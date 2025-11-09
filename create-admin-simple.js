#!/usr/bin/env node

/**
 * Create Admin User Script (Simple Version)
 * 
 * This script creates a new admin user with email admin@indianwarehouse.com
 * Usage: node create-admin-simple.js <password>
 * 
 * Example: node create-admin-simple.js MySecurePassword123
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdminUser(password) {
  try {
    const email = 'admin@indianwarehouse.com';
    
    console.log('🔐 Creating Admin User');
    console.log('═══════════════════════════════════════');
    console.log(`📧 Email: ${email}`);
    console.log('');

    // Validate password
    if (!password || password.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      console.log('⚠️  User with this email already exists!');
      console.log(`   Updating to admin role...`);
      
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update user to admin
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash: hashedPassword,
          role: 'admin',
          isActive: true,
          isEmailVerified: true,
          updatedAt: new Date()
        }
      });

      console.log('');
      console.log('✅ Admin user updated successfully!');
      console.log('═══════════════════════════════════════');
      console.log(`📧 Email: ${updatedUser.email}`);
      console.log(`👤 Name: ${updatedUser.firstName} ${updatedUser.lastName}`);
      console.log(`🔑 Role: ${updatedUser.role}`);
      console.log('');

    } else {
      // Hash password
      console.log('🔐 Hashing password...');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create admin user
      console.log('💾 Creating admin user in database...');
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: false
        }
      });

      console.log('');
      console.log('✅ Admin user created successfully!');
      console.log('═══════════════════════════════════════');
      console.log(`🆔 User ID: ${newUser.id}`);
      console.log(`📧 Email: ${newUser.email}`);
      console.log(`👤 Name: ${newUser.firstName} ${newUser.lastName}`);
      console.log(`🔑 Role: ${newUser.role}`);
      console.log(`✅ Active: ${newUser.isActive ? 'Yes' : 'No'}`);
      console.log('');
      console.log('🎉 You can now login with:');
      console.log(`   Email: ${newUser.email}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === 'P2002') {
      console.error('   This email is already registered.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get password from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node create-admin-simple.js <password>');
  console.log('Example: node create-admin-simple.js MySecurePassword123');
  console.log('');
  console.log('⚠️  Note: For secure password input, use: node create-admin.js');
  process.exit(1);
}

const password = args[0];

// Run the script
createAdminUser(password);

