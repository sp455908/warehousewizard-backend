"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const notificationService_1 = require("../services/notificationService");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../config/prisma");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
class AuthController {
    async register(req, res) {
        try {
            const userData = req.body;
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { email: userData.email } });
            if (existingUser) {
                return res.status(400).json({ message: "Email already registered" });
            }
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(userData.password, saltRounds);
            const user = await prisma_1.prisma.user.create({
                data: {
                    email: userData.email,
                    passwordHash: hashedPassword,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    mobile: userData.mobile,
                    company: userData.company,
                    role: userData.role || "customer",
                    isActive: true,
                    isEmailVerified: false,
                    isMobileVerified: false,
                }
            });
            const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
            const token = (0, auth_1.generateToken)(user.id);
            await notificationService_1.notificationService.sendEmail({
                to: user.email,
                subject: "Welcome to Warehouse Wizard",
                html: `
          <h2>Welcome to Warehouse Wizard!</h2>
          <p>Hello ${user.firstName},</p>
          <p>Your account has been created successfully.</p>
          <p>You can now start exploring our warehouse solutions.</p>
        `,
            });
            const { passwordHash, ...userResponse } = user;
            res.status(201).json({
                message: "Registration successful",
                user: userResponse,
                token,
            });
            return;
        }
        catch (error) {
            console.error("Registration error:", error);
            return res.status(500).json({ message: "Registration failed", error });
        }
    }
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
            if (!user.isActive) {
                return res.status(401).json({ message: "Account is deactivated" });
            }
            const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
            const token = (0, auth_1.generateToken)(user.id);
            await prisma_1.prisma.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
            const { passwordHash: _, ...userResponse } = user;
            res.json({
                message: "Login successful",
                user: userResponse,
                token,
            });
            return;
        }
        catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({ message: "Login failed", error });
        }
    }
    async logout(req, res) {
        try {
            return res.json({ message: "Logout successful" });
        }
        catch (error) {
            return res.status(500).json({ message: "Logout failed", error });
        }
    }
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.json({ message: "If the email exists, a reset link has been sent" });
            }
            const resetToken = crypto_1.default.randomBytes(32).toString("hex");
            const resetTokenExpiry = new Date(Date.now() + 3600000);
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            await notificationService_1.notificationService.sendEmail({
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
            return res.json({ message: "If the email exists, a reset link has been sent" });
        }
        catch (error) {
            console.error("Forgot password error:", error);
            return res.status(500).json({ message: "Failed to process request", error });
        }
    }
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
            return res.json({ message: "Password reset successful" });
        }
        catch (error) {
            console.error("Reset password error:", error);
            return res.status(500).json({ message: "Password reset failed", error });
        }
    }
    async verifyEmail(req, res) {
        try {
            const { token } = req.body;
            return res.json({ message: "Email verified successfully" });
        }
        catch (error) {
            return res.status(500).json({ message: "Email verification failed", error });
        }
    }
    async resendVerification(req, res) {
        try {
            const { email } = req.body;
            const user = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            if (user.isEmailVerified) {
                return res.status(400).json({ message: "Email already verified" });
            }
            return res.json({ message: "Verification email sent" });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to resend verification", error });
        }
    }
    async createGuestUser(req, res) {
        try {
            const { email, firstName, lastName, mobile, company } = req.body;
            const tempPassword = crypto_1.default.randomBytes(8).toString("hex");
            const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 12);
            const guestUser = await prisma_1.prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    mobile,
                    company,
                    passwordHash: hashedPassword,
                    role: "customer",
                    isActive: false,
                    isEmailVerified: false,
                    isMobileVerified: false,
                }
            });
            await notificationService_1.notificationService.sendEmail({
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
            return res.status(201).json({
                message: "Guest user created successfully",
                userId: guestUser.id,
            });
        }
        catch (error) {
            console.error("Guest user creation error:", error);
            return res.status(500).json({ message: "Failed to create guest user", error });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=authController.js.map