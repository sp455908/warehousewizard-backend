#!/usr/bin/env node

/**
 * Password Reset Script for Warehouse Wizard
 * 
 * This script resets the password for a specific user by email.
 * Usage: node reset-password.js <email> <new-password>
 * 
 * Example: node reset-password.js shubhampatil@gmail.com newpassword123
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPassword(email, newPassword) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName} (${user.role})`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔐 Active: ${user.isActive ? 'Yes' : 'No'}`);

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Hash the new password using the same method as the application
    const saltRounds = 12;
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    console.log('💾 Updating password in database...');
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: hashedPassword,
        updatedAt: new Date()
      }
    });

    console.log('✅ Password reset successfully!');
    console.log(`📧 User: ${user.firstName} ${user.lastName}`);
    console.log(`🔑 New password: ${newPassword}`);
    console.log('⚠️  Please inform the user to change their password after login.');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log('Usage: node reset-password.js <email> <new-password>');
  console.log('Example: node reset-password.js shubhampatil@gmail.com newpassword123');
  process.exit(1);
}

const [email, newPassword] = args;

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

// Run the password reset
resetPassword(email, newPassword);
