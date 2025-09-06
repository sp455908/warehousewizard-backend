import { Router } from "express";
import { authController } from "../controllers/authController";
import { validateRequest } from "../middleware/validation";
import { authLimiter } from "../middleware/rateLimiter";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobile: z.string().optional(),
  company: z.string().optional(),
});

// Apply rate limiting to auth routes
router.use(authLimiter);

// Public auth routes
router.post("/register", validateRequest(registerSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

// Guest user creation
router.post("/guest", authController.createGuestUser);

export default router;