#!/usr/bin/env node

/**
 * Admin Password Reset Script for Warehouse Wizard
 * 
 * This script provides admin-level password reset functionality with additional security checks.
 * Usage: node admin-reset-password.js <email> [options]
 * 
 * Options:
 *   --password <password>  Set a specific password
 *   --generate            Generate a random password
 *   --list-users          List all users (for finding the correct email)
 *   --deactivate          Deactivate the user account
 *   --activate            Activate the user account
 * 
 * Examples:
 *   node admin-reset-password.js shubhampatil@gmail.com --password newpass123
 *   node admin-reset-password.js shubhampatil@gmail.com --generate
 *   node admin-reset-password.js --list-users
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function listUsers() {
  try {
    console.log('📋 Fetching all users...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      return;
    }

    console.log('👥 Users in the system:\n');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ ID                                   │ Name                │ Email                    │ Role        │ Active │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────┤');
    
    users.forEach(user => {
      const name = `${user.firstName} ${user.lastName}`.padEnd(20);
      const email = user.email.padEnd(24);
      const role = user.role.padEnd(11);
      const active = user.isActive ? '✅' : '❌';
      console.log(`│ ${user.id} │ ${name} │ ${email} │ ${role} │ ${active}   │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────────────────────────┘');
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
  }
}

async function resetPassword(email, newPassword, options = {}) {
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
        isActive: true,
        isEmailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      console.log('💡 Use --list-users to see all available users');
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
    console.log(`   Email Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
    console.log(`   Created: ${user.createdAt.toISOString()}`);

    // Handle account activation/deactivation
    if (options.deactivate) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false, updatedAt: new Date() }
      });
      console.log('✅ Account deactivated successfully');
      return;
    }

    if (options.activate) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, updatedAt: new Date() }
      });
      console.log('✅ Account activated successfully');
      return;
    }

    // Generate password if not provided
    if (!newPassword) {
      newPassword = generateRandomPassword(12);
      console.log(`🔑 Generated random password: ${newPassword}`);
    }

    // Validate password
    if (newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters long');
      return;
    }

    // Confirm password reset
    if (!options.force) {
      const confirm = await askQuestion(`\n⚠️  Are you sure you want to reset the password for ${user.email}? (yes/no): `);
      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('❌ Password reset cancelled');
        return;
      }
    }

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const saltRounds = 12;
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

    console.log('\n✅ Password reset successfully!');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                    RESET SUMMARY                       │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ User: ${user.firstName} ${user.lastName}`.padEnd(59) + '│');
    console.log(`│ Email: ${user.email}`.padEnd(59) + '│');
    console.log(`│ New Password: ${newPassword}`.padEnd(59) + '│');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n⚠️  IMPORTANT: Please inform the user to change their password after login.');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🔐 Admin Password Reset Script for Warehouse Wizard

Usage: node admin-reset-password.js <email> [options]

Options:
  --password <password>  Set a specific password
  --generate            Generate a random password
  --list-users          List all users (for finding the correct email)
  --deactivate          Deactivate the user account
  --activate            Activate the user account
  --force               Skip confirmation prompt

Examples:
  node admin-reset-password.js shubhampatil@gmail.com --password newpass123
  node admin-reset-password.js shubhampatil@gmail.com --generate
  node admin-reset-password.js --list-users
  node admin-reset-password.js shubhampatil@gmail.com --deactivate
    `);
    process.exit(0);
  }

  try {
    // Handle list users command
    if (args.includes('--list-users')) {
      await listUsers();
      return;
    }

    // Get email (first argument that's not an option)
    const email = args.find(arg => !arg.startsWith('--'));
    if (!email) {
      console.error('❌ Email is required');
      process.exit(1);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }

    // Parse options
    const options = {
      generate: args.includes('--generate'),
      deactivate: args.includes('--deactivate'),
      activate: args.includes('--activate'),
      force: args.includes('--force')
    };

    // Get password
    let password = null;
    const passwordIndex = args.indexOf('--password');
    if (passwordIndex !== -1 && args[passwordIndex + 1]) {
      password = args[passwordIndex + 1];
    }

    await resetPassword(email, password, options);

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
