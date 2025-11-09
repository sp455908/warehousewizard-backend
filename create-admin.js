#!/usr/bin/env node

/**
 * Create Admin User Script for Warehouse Wizard
 * 
 * This script creates a new admin user with email admin@indianwarehouse.com
 * Usage: node create-admin.js
 * 
 * The script will prompt you to enter a password securely.
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    // Hide password input
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          console.log(''); // New line after password input
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function createAdminUser() {
  try {
    const email = 'admin@indianwarehouse.com';
    
    console.log('🔐 Creating Admin User');
    console.log('═══════════════════════════════════════');
    console.log(`📧 Email: ${email}`);
    console.log('');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      console.log('⚠️  User with this email already exists!');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Name: ${existingUser.firstName} ${existingUser.lastName}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Active: ${existingUser.isActive ? 'Yes' : 'No'}`);
      console.log('');
      
      const overwrite = await askQuestion('Do you want to update this user to admin? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
        console.log('❌ Operation cancelled.');
        process.exit(0);
      }

      // Get password
      const password = await askPassword('Enter new password: ');
      if (!password || password.length < 6) {
        console.error('❌ Password must be at least 6 characters long');
        process.exit(1);
      }

      // Hash password
      console.log('🔐 Hashing password...');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update user to admin
      console.log('💾 Updating user to admin...');
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
      console.log(`✅ Active: ${updatedUser.isActive ? 'Yes' : 'No'}`);
      console.log(`📧 Email Verified: ${updatedUser.isEmailVerified ? 'Yes' : 'No'}`);
      console.log('');

    } else {
      // Get user details
      const firstName = await askQuestion('Enter first name (default: Admin): ') || 'Admin';
      const lastName = await askQuestion('Enter last name (default: User): ') || 'User';
      
      // Get password
      const password = await askPassword('Enter password: ');
      if (!password || password.length < 6) {
        console.error('❌ Password must be at least 6 characters long');
        process.exit(1);
      }

      const confirmPassword = await askPassword('Confirm password: ');
      if (password !== confirmPassword) {
        console.error('❌ Passwords do not match!');
        process.exit(1);
      }

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
          firstName: firstName,
          lastName: lastName,
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
      console.log(`📧 Email Verified: ${newUser.isEmailVerified ? 'Yes' : 'No'}`);
      console.log('');
      console.log('🎉 You can now login with:');
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Password: [the password you entered]`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === 'P2002') {
      console.error('   This email is already registered.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run the script
console.log('');
createAdminUser();

