# Password Reset Scripts for Warehouse Wizard

This directory contains scripts to reset user passwords in the Warehouse Wizard system.

## 🔐 Available Scripts

### 1. Simple Password Reset (`reset-password.js`)
A basic script to reset a user's password by email.

**Usage:**
```bash
node reset-password.js <email> <new-password>
```

**Example:**
```bash
node reset-password.js shubhampatil@gmail.com newpassword123
```

### 2. Admin Password Reset (`admin-reset-password.js`)
An advanced script with additional features for administrators.

**Usage:**
```bash
node admin-reset-password.js <email> [options]
```

**Options:**
- `--password <password>` - Set a specific password
- `--generate` - Generate a random password
- `--list-users` - List all users in the system
- `--deactivate` - Deactivate the user account
- `--activate` - Activate the user account
- `--force` - Skip confirmation prompt

**Examples:**
```bash
# Reset with specific password
node admin-reset-password.js shubhampatil@gmail.com --password newpass123

# Generate random password
node admin-reset-password.js shubhampatil@gmail.com --generate

# List all users
node admin-reset-password.js --list-users

# Deactivate account
node admin-reset-password.js shubhampatil@gmail.com --deactivate
```

### 3. Batch/Shell Scripts
For easy execution on different platforms:

**Windows:**
```cmd
reset-password.bat shubhampatil@gmail.com newpassword123
```

**Linux/Mac:**
```bash
chmod +x reset-password.sh
./reset-password.sh shubhampatil@gmail.com newpassword123
```

## 🚀 Quick Start

### For the specific user (shubhampatil@gmail.com):

1. **Navigate to the project directory:**
   ```bash
   cd project
   ```

2. **Run the simple reset script:**
   ```bash
   node reset-password.js shubhampatil@gmail.com newpassword123
   ```

3. **Or use the admin script for more options:**
   ```bash
   node admin-reset-password.js shubhampatil@gmail.com --generate
   ```

## 🔒 Security Features

- **Password Hashing**: Uses bcrypt with 12 salt rounds (same as the application)
- **Email Validation**: Validates email format before processing
- **User Verification**: Confirms user exists before resetting
- **Confirmation**: Admin script asks for confirmation before resetting
- **Audit Trail**: Logs all actions for security tracking

## 📋 Prerequisites

- Node.js installed
- Prisma client configured
- Database connection established
- Access to the project directory

## ⚠️ Important Notes

1. **Security**: These scripts should only be run by authorized administrators
2. **Password Policy**: New passwords must be at least 6 characters long
3. **User Notification**: Always inform users to change their password after login
4. **Backup**: Consider backing up the database before running these scripts
5. **Logs**: Check console output for success/failure messages

## 🐛 Troubleshooting

### Common Issues:

1. **"User not found"**
   - Verify the email address is correct
   - Use `--list-users` to see all available users

2. **"Database connection error"**
   - Ensure the database is running
   - Check your DATABASE_URL environment variable

3. **"Permission denied"**
   - Make sure you have the necessary database permissions
   - Run with appropriate user privileges

### Getting Help:

If you encounter issues:
1. Check the console output for error messages
2. Verify the user exists using `--list-users`
3. Ensure the database is accessible
4. Check file permissions for the script files

## 📞 Support

For additional help or security concerns, contact the system administrator.
