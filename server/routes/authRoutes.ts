import { Router } from "express";
import { authController } from "../controllers/authController";
import { validateRequest } from "../middleware/validation";
import { authLimiter } from "../middleware/rateLimiter";
import { insertUserSchema } from "@shared/schema";
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

// Apply rate limiting to auth routes
router.use(authLimiter);

// Public auth routes
router.post("/register", validateRequest(insertUserSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

// Guest user creation
router.post("/guest", authController.createGuestUser);

export default router;