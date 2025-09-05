import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel, type InsertUser } from "../../shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";

export class UserController {
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { password, ...userProfile } = user.toObject();
      res.json(userProfile);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch profile", error });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const updateData = req.body;
      
      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.password;
      delete updateData.role;
      delete updateData.isActive;

      const user = await UserModel.findByIdAndUpdate(
        userId,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userProfile } = user.toObject();
      res.json(userProfile);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update profile", error });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await UserModel.findByIdAndUpdate(userId, { 
        password: hashedPassword,
        updatedAt: new Date()
      });

      res.json({ message: "Password changed successfully" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to change password", error });
    }
  }

  async getAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const { role, isActive, page = 1, limit = 20 } = req.query;
      
      const filter: any = {};
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        UserModel.countDocuments(filter)
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
      
      const user = await UserModel.findById(id).select('-password');
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
      const userData: InsertUser = req.body;
      
      // Check if user already exists
      const existingUser = await UserModel.findOne({ email: userData.email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const user = new UserModel({
        ...userData,
        password: hashedPassword,
      });

      await user.save();

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
      const { password, ...userResponse } = user.toObject();
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

      // Check if user exists and is an admin
      const existingUser = await UserModel.findById(id);
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
        updateData.password = await bcrypt.hash(updateData.password, saltRounds);
      }

      const user = await UserModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).select('-password');

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update user", error });
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!._id.toString();

      // Prevent admin from deleting themselves
      if (id === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Check if user exists and is an admin
      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deletion of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deleted" });
      }

      const user = await UserModel.findByIdAndDelete(id);

      res.json({ message: "User deleted successfully" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete user", error });
    }
  }

  async getUsersByRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { role } = req.params;
      
      const users = await UserModel.find({ role, isActive: true })
        .select('-password')
        .sort({ firstName: 1, lastName: 1 });

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
      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent activation/deactivation of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deactivated" });
      }

      const user = await UserModel.findByIdAndUpdate(
        id,
        { isActive: true, updatedAt: new Date() },
        { new: true }
      ).select('-password');

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
      const currentUserId = req.user!._id.toString();

      // Prevent admin from deactivating themselves
      if (id === currentUserId) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }

      // Check if user exists and is an admin
      const existingUser = await UserModel.findById(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deactivation of admin users
      if (existingUser.role === "admin") {
        return res.status(403).json({ message: "Admin users cannot be deactivated" });
      }

      const user = await UserModel.findByIdAndUpdate(
        id,
        { isActive: false, updatedAt: new Date() },
        { new: true }
      ).select('-password');

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

      const user = await UserModel.findOneAndUpdate(
        { _id: id, role: "customer", isActive: false },
        { isActive: true, updatedAt: new Date() },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: "Guest customer not found" });
      }

      // Send verification notification
      await notificationService.sendEmail({
        to: user.email,
        subject: "Account Verified - Warehouse Wizard",
        html: `
          <h2>Account Verified</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your guest account has been verified and activated.</p>
          <p>You can now access all customer features.</p>
        `,
      });

      res.json(user);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify guest customer", error });
    }
  }

  async getPendingGuestCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const guestCustomers = await UserModel.find({
        role: "customer",
        isActive: false
      })
      .select('-password')
      .sort({ createdAt: -1 });

      res.json(guestCustomers);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending guest customers", error });
    }
  }

  async getRoles(req: AuthenticatedRequest, res: Response) {
    try {
      // Import userRoles from schema
      const { userRoles } = require("../../shared/schema");
      
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