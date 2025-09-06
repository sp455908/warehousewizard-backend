"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const adminSecurity_1 = require("../middleware/adminSecurity");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string(),
    password: zod_1.z.string().min(6),
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    mobile: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
});
router.use(rateLimiter_1.authLimiter);
router.use(adminSecurity_1.logAdminAttempts);
router.use(adminSecurity_1.preventAdminRoleCreation);
router.post("/register", (0, validation_1.validateRequest)(registerSchema), authController_1.authController.register);
router.post("/login", (0, validation_1.validateRequest)(loginSchema), authController_1.authController.login);
router.post("/logout", authController_1.authController.logout);
router.post("/forgot-password", (0, validation_1.validateRequest)(forgotPasswordSchema), authController_1.authController.forgotPassword);
router.post("/reset-password", (0, validation_1.validateRequest)(resetPasswordSchema), authController_1.authController.resetPassword);
router.post("/verify-email", authController_1.authController.verifyEmail);
router.post("/resend-verification", authController_1.authController.resendVerification);
router.post("/guest", authController_1.authController.createGuestUser);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map