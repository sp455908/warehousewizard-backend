import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All roles routes require authentication
router.use(authenticateToken);

// Get all available roles (admin only)
router.get("/", authorizeRoles("admin"), userController.getRoles);

export default router;
