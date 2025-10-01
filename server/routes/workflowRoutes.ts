import { Router } from "express";
import { workflowController } from "../controllers/workflowController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All workflow routes require authentication
router.use(authenticateToken);

// Get complete workflow history for a specific request
router.get("/history/:requestType/:requestId", workflowController.getWorkflowHistory);

// Get dashboard-specific workflow history
router.get("/dashboard-history", workflowController.getDashboardWorkflowHistory);

export default router;
