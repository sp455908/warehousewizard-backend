import { Router } from "express";
import { settingsController } from "../controllers/settingsController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All settings routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles("admin"));

// General settings
router.get("/general", settingsController.getGeneralSettings);
router.put("/general", settingsController.updateGeneralSettings);

// Security settings
router.get("/security", settingsController.getSecuritySettings);
router.put("/security", settingsController.updateSecuritySettings);

// Email settings
router.get("/email", settingsController.getEmailSettings);
router.put("/email", settingsController.updateEmailSettings);
router.post("/email/test", settingsController.testEmailConfig);

export default router;
