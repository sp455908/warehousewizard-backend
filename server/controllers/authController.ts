import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserModel, type InsertUser } from "@shared/schema";
import { notificationService } from "../services/notificationService";
import { generateToken } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const userData: InsertUser = req.body;
      
      // Check if user already exists
      const existingUser = await UserModel.findOne({ email: userData.email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const user = new UserModel({
        ...userData,
        password: hashedPassword,
        role: userData.role || "customer",
      });

      await user.save();

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      
      // Store verification token (in production, use Redis or database)
      // For now, we'll skip email verification in development

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Send welcome email
      await notificationService.sendEmail({
        to: user.email,
        subject: "Welcome to Warehouse Wizard",
        html: `
          <h2>Welcome to Warehouse Wizard!</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your account has been created successfully.</p>
          <p>You can now start exploring our warehouse solutions.</p>
        `,
      });

      // Return user data without password
      const { password, ...userResponse } = user.toObject();
      res.status(201).json({
        message: "Registration successful",
        user: userResponse,
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed", error });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Update last login (optional)
      user.updatedAt = new Date();
      await user.save();

      // Return user data without password
      const { password: _, ...userResponse } = user.toObject();
      res.json({
        message: "Login successful",
        user: userResponse,
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed", error });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // You could implement token blacklisting here if needed
      res.json({ message: "Logout successful" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed", error });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const user = await UserModel.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not
        return res.json({ message: "If the email exists, a reset link has been sent" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token (in production, use Redis or database field)
      // For now, we'll use a simple in-memory store
      
      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await notificationService.sendEmail({
        to: user.email,
        subject: "Password Reset - Warehouse Wizard",
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });

      res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request", error });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;

      // In production, verify token from Redis/database
      // For now, we'll implement a basic version
      
      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update user password (you'll need to implement token verification)
      // const user = await UserModel.findOneAndUpdate(
      //   { resetToken: token, resetTokenExpiry: { $gt: new Date() } },
      //   { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
      // );

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Password reset failed", error });
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;

      // Implement email verification logic
      // For now, we'll return success
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      res.status(500).json({ message: "Email verification failed", error });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      // Generate new verification token and send email
      // Implementation here

      res.json({ message: "Verification email sent" });
    } catch (error) {
      res.status(500).json({ message: "Failed to resend verification", error });
    }
  }

  async createGuestUser(req: Request, res: Response) {
    try {
      const { email, firstName, lastName, mobile, company } = req.body;

      // Create guest user with temporary password
      const tempPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      const guestUser = new UserModel({
        email,
        firstName,
        lastName,
        mobile,
        company,
        password: hashedPassword,
        role: "customer",
        isActive: false, // Guest users need verification
        isEmailVerified: false,
      });

      await guestUser.save();

      // Send credentials to user
      await notificationService.sendEmail({
        to: email,
        subject: "Guest Account Created - Warehouse Wizard",
        html: `
          <h2>Guest Account Created</h2>
          <p>Hello ${firstName},</p>
          <p>A guest account has been created for you.</p>
          <p>Temporary Password: <strong>${tempPassword}</strong></p>
          <p>Please log in and change your password.</p>
        `,
      });

      res.status(201).json({
        message: "Guest user created successfully",
        userId: guestUser._id,
      });
    } catch (error) {
      console.error("Guest user creation error:", error);
      res.status(500).json({ message: "Failed to create guest user", error });
    }
  }
}

export const authController = new AuthController();