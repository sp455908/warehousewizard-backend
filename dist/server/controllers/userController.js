"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const notificationService_1 = require("../services/notificationService");
class UserController {
    async getProfile(req, res) {
        try {
            const user = req.user;
            const { passwordHash, ...userProfile } = user;
            res.json(userProfile);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch profile", error });
        }
    }
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            delete updateData.passwordHash;
            delete updateData.role;
            delete updateData.isActive;
            const user = await prisma_1.prisma.user.update({
                where: { id: userId },
                data: updateData
            });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const { passwordHash, ...userProfile } = user;
            res.json(userProfile);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update profile", error });
        }
    }
    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                return res.status(400).json({ message: "Current password is incorrect" });
            }
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, saltRounds);
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { passwordHash: hashedPassword }
            });
            res.json({ message: "Password changed successfully" });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to change password", error });
        }
    }
    async getAllUsers(req, res) {
        try {
            const { role, isActive, page = 1, limit = 20 } = req.query;
            const filter = {};
            if (role)
                filter.role = role;
            if (isActive !== undefined)
                filter.isActive = isActive === 'true';
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const [users, total] = await Promise.all([
                prisma_1.prisma.user.findMany({
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
                    take: parseInt(limit)
                }),
                prisma_1.prisma.user.count({ where: filter })
            ]);
            res.json({
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch users", error });
        }
    }
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await prisma_1.prisma.user.findUnique({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch user", error });
        }
    }
    async createUser(req, res) {
        try {
            const userData = req.body;
            const existingUser = await prisma_1.prisma.user.findUnique({
                where: { email: userData.email }
            });
            if (existingUser) {
                return res.status(400).json({ message: "Email already exists" });
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
                    role: userData.role || 'customer',
                    isActive: userData.isActive ?? true,
                    isEmailVerified: userData.isEmailVerified ?? false,
                    isMobileVerified: userData.isMobileVerified ?? false,
                }
            });
            await notificationService_1.notificationService.sendEmail({
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
            const { passwordHash, ...userResponse } = user;
            res.status(201).json(userResponse);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create user", error });
        }
    }
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { id } });
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            if (existingUser.role === "admin") {
                return res.status(403).json({ message: "Admin users cannot be modified" });
            }
            if (updateData.password) {
                const saltRounds = 12;
                updateData.passwordHash = await bcryptjs_1.default.hash(updateData.password, saltRounds);
                delete updateData.password;
            }
            const user = await prisma_1.prisma.user.update({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update user", error });
        }
    }
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const currentUserId = req.user.id;
            if (id === currentUserId) {
                return res.status(400).json({ message: "Cannot delete your own account" });
            }
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { id } });
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            if (existingUser.role === "admin") {
                return res.status(403).json({ message: "Admin users cannot be deleted" });
            }
            await prisma_1.prisma.user.delete({ where: { id } });
            res.json({ message: "User deleted successfully" });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to delete user", error });
        }
    }
    async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            const users = await prisma_1.prisma.user.findMany({
                where: { role: role, isActive: true },
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch users by role", error });
        }
    }
    async activateUser(req, res) {
        try {
            const { id } = req.params;
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { id } });
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            if (existingUser.role === "admin") {
                return res.status(403).json({ message: "Admin users cannot be deactivated" });
            }
            const user = await prisma_1.prisma.user.update({
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
            await notificationService_1.notificationService.sendEmail({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to activate user", error });
        }
    }
    async deactivateUser(req, res) {
        try {
            const { id } = req.params;
            const currentUserId = req.user.id;
            if (id === currentUserId) {
                return res.status(400).json({ message: "Cannot deactivate your own account" });
            }
            const existingUser = await prisma_1.prisma.user.findUnique({ where: { id } });
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            if (existingUser.role === "admin") {
                return res.status(403).json({ message: "Admin users cannot be deactivated" });
            }
            const user = await prisma_1.prisma.user.update({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to deactivate user", error });
        }
    }
    async verifyGuestCustomer(req, res) {
        try {
            const { id } = req.params;
            const user = await prisma_1.prisma.user.updateMany({
                where: { id, role: "customer", isActive: false },
                data: { isActive: true }
            });
            if (user.count === 0) {
                return res.status(404).json({ message: "Guest customer not found" });
            }
            const updatedUser = await prisma_1.prisma.user.findUnique({
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
            await notificationService_1.notificationService.sendEmail({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to verify guest customer", error });
        }
    }
    async getPendingGuestCustomers(req, res) {
        try {
            const guestCustomers = await prisma_1.prisma.user.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch pending guest customers", error });
        }
    }
    async getRoles(req, res) {
        try {
            const userRoles = ['customer', 'purchase_support', 'sales_support', 'supervisor', 'warehouse', 'accounts', 'admin'];
            const roles = userRoles.map((role) => ({
                value: role,
                label: role.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                description: getRoleDescription(role)
            }));
            res.json(roles);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch roles", error });
        }
    }
}
exports.UserController = UserController;
function getRoleDescription(role) {
    const descriptions = {
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
exports.userController = new UserController();
//# sourceMappingURL=userController.js.map