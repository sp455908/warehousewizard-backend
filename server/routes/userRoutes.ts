import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobile: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(["customer", "purchase_support", "sales_support", "supervisor", "warehouse", "accounts", "admin"]).default("customer"),
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  isMobileVerified: z.boolean().default(false),
});

// All user routes require authentication
router.use(authenticateToken);

// Profile routes (all authenticated users)
router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);
router.post("/change-password", userController.changePassword);

// Admin-only user management routes
router.get("/", authorizeRoles("admin"), userController.getAllUsers);
router.get("/:id", authorizeRoles("admin"), userController.getUserById);
router.post("/", authorizeRoles("admin"), validateRequest(insertUserSchema), userController.createUser);
router.put("/:id", authorizeRoles("admin"), userController.updateUser);
router.delete("/:id", authorizeRoles("admin"), userController.deleteUser);

// Role-specific routes
router.get("/role/:role", authorizeRoles("admin"), userController.getUsersByRole);

// User activation/deactivation
router.post("/:id/activate", authorizeRoles("admin"), userController.activateUser);
router.post("/:id/deactivate", authorizeRoles("admin"), userController.deactivateUser);

// Guest customer verification
router.post("/:id/verify", authorizeRoles("purchase_support", "admin"), userController.verifyGuestCustomer);
router.get("/guests/pending", authorizeRoles("purchase_support", "admin"), userController.getPendingGuestCustomers);

export default router;