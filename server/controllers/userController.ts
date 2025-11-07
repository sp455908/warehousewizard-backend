import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { UserRole } from "@prisma/client";

export class UserController {
  // Lightweight list of active customers for admin panels
  async getActiveCustomersList(req: AuthenticatedRequest, res: Response) {
    try {
      const customers = await prisma.user.findMany({
        where: { role: "customer", isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
      });

      return res.json(customers);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch customers", error });
    }
  }
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { passwordHash, ...userProfile } = user;
      res.json(userProfile);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch profile", error });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const updateData = req.body;
      
      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.passwordHash;
      delete updateData.role;
      delete updateData.isActive;

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { passwordHash, ...userProfile } = user;
      res.json(userProfile);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update profile", error });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedPassword }
      });

      res.json({ message: "Password changed successfully" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to change password", error });
    }
  }

  // Admin: force change password for a user
  async changePasswordAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id }, data: { passwordHash: hashedPassword } });

      // Optionally notify user
      const user = await prisma.user.findUnique({ where: { id } });
      if (user) {
        await notificationService.sendEmail({
          to: user.email,
          subject: "Your password was changed",
          html: `<p>Your account password was changed by an administrator. If this was not you, please contact support immediately.</p>`,
        });
      }

      return res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Admin change password error:", err);
      return res.status(500).json({ message: "Failed to change password" });
    }
  }

  async getAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, isActive, page = 1, limit = 20 } = req.query;
      
      const filter: any = {};
      if (role) filter.role = role as UserRole;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: filter,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            mobile: true,
            company: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            isMobileVerified: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit as string)
        }),
        prisma.user.count({ where: filter })
      ]);

      res.json({
        users,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch users", error });
    }
  }

  async getUserById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch user", error });
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userData = req.body;
      
      // SECURITY: Prevent admin role creation through user creation
      if (userData.role === "admin") {
        console.warn("🚨 SECURITY ALERT: Attempted admin role creation through user creation");
        return res.status(403).json({ 
          message: "Admin role cannot be created through user management. Contact system administrator." 
        });
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ 
        where: { email: userData.email } 
      });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user (admin role is blocked)
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          mobile: userData.mobile,
          company: userData.company,
          role: userData.role === "admin" ? "customer" : (userData.role || 'customer'), // Force non-admin role
          isActive: userData.isActive ?? true,
          isEmailVerified: userData.isEmailVerified ?? false,
          isMobileVerified: userData.isMobileVerified ?? false,
        }
      });

      // Send welcome email
      await notificationService.sendEmail({
        to: user.email,
        subject: "Account Created - Warehouse Wizard",
        html: `
          <h2>Account Created</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your account has been created by an administrator.</p>
          <p>Email: ${user.email}</p>
          <p>Role: ${user.role}</p>
          <p>Please log in and change your password.</p>
        `,
      });

      // Return user without password
      const { passwordHash, ...userResponse } = user;
      res.status(201).json(userResponse);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create user", error });
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const updateData = req.body;

      // SECURITY: Prevent admin role assignment through updates
      if (updateData.role === "admin") {
        console.warn("🚨 SECURITY ALERT: Attempted admin role assignment through user update");
        return res.status(403).json({ 
          message: "Admin role cannot be assigned through user updates. Contact system administrator." 
        });
      }

      // Check if user exists and is an admin
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent modification of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be modified" });
      }

      // If password is being updated, hash it
      if (updateData.password) {
        const saltRounds = 12;
        updateData.passwordHash = await bcrypt.hash(updateData.password, saltRounds);
        delete updateData.password;
      }

      // Remove any attempt to set admin role
      delete updateData.role;

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update user", error });
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.id;

      // Prevent admin from deleting themselves
      if (id === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Check if user exists and get their role
      const existingUser = await prisma.user.findUnique({ 
        where: { id },
        include: {
          ownedWarehouses: {
            select: { id: true, name: true }
          }
        }
      });
      
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deletion of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deleted" });
      }

      // If deleting a warehouse user, also delete their warehouses
      if (existingUser.role === "warehouse" && existingUser.ownedWarehouses.length > 0) {
        // Delete all warehouses owned by this user
        await prisma.warehouse.deleteMany({
          where: { ownerId: id }
        });
      }

      await prisma.user.delete({ where: { id } });

      const message = existingUser.role === "warehouse" && existingUser.ownedWarehouses.length > 0
        ? `User and ${existingUser.ownedWarehouses.length} associated warehouses deleted successfully`
        : "User deleted successfully";

      res.json({ message });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete user", error });
    }
  }

  async getUsersByRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { role } = req.params;
      
      const users = await prisma.user.findMany({
        where: { role: role as UserRole, isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      });

      res.json(users);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch users by role", error });
    }
  }

  async activateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if user exists and is an admin
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent activation/deactivation of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deactivated" });
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send activation notification
      await notificationService.sendEmail({
        to: user.email,
        subject: "Account Activated - Warehouse Wizard",
        html: `
          <h2>Account Activated</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your account has been activated. You can now access all features.</p>
        `,
      });

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to activate user", error });
    }
  }

  async deactivateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.id;

      // Prevent admin from deactivating themselves
      if (id === currentUserId) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }

      // Check if user exists and is an admin
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deactivation of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deactivated" });
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to deactivate user", error });
    }
  }

  async verifyGuestCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.updateMany({
        where: { id, role: "customer", isActive: false },
        data: { isActive: true }
      });

      if (user.count === 0) {
        return res.status(404).json({ message: "Guest customer not found" });
      }

      const updatedUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "Guest customer not found" });
      }

      // Send verification notification
      await notificationService.sendEmail({
        to: updatedUser.email,
        subject: "Account Verified - Warehouse Wizard",
        html: `
          <h2>Account Verified</h2>
          <p>Hello ${updatedUser.firstName},</p>
          <p>Your guest account has been verified and activated.</p>
          <p>You can now access all customer features.</p>
        `,
      });

      res.json(updatedUser);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify guest customer", error });
    }
  }

  async getPendingGuestCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const guestCustomers = await prisma.user.findMany({
        where: {
          role: "customer",
          isActive: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(guestCustomers);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending guest customers", error });
    }
  }

  async getRoles(req: AuthenticatedRequest, res: Response) {
    try {
      // Define user roles from Prisma enum
      const userRoles = ['customer', 'purchase_support', 'sales_support', 'supervisor', 'warehouse', 'accounts', 'admin'];
      
      // Return roles with additional metadata
      const roles = userRoles.map((role: string) => ({
        value: role,
        label: role.split('_').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        description: getRoleDescription(role)
      }));

      res.json(roles);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch roles", error });
    }
  }

  async getDeniedCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const deniedCustomers = await prisma.user.findMany({
        where: {
          role: "customer",
          isActive: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          company: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      res.json(deniedCustomers);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch denied customers", error });
    }
  }
}

// Helper function to get role descriptions
function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    customer: "Can create quotes, manage bookings, and track deliveries",
    purchase_support: "Processes quote requests and verifies customers",
    sales_support: "Reviews and approves quotes",
    supervisor: "Approves bookings and oversees operations",
    warehouse: "Manages inventory and processes cargo",
    accounts: "Handles invoicing and payments",
    admin: "Full system access and user management"
  };
  return descriptions[role] || "No description available";
}

export const userController = new UserController();