import { Router } from "express";
import { workflowStateController } from "../controllers/workflowStateController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All workflow state routes require authentication
router.use(authenticateToken);

// Get workflow state for a specific quote
router.get("/state/:quoteId", workflowStateController.getWorkflowState.bind(workflowStateController));
// Admin: latest workflow snapshot for a given customer
router.get("/customer/:customerId/latest", authorizeRoles("admin"), workflowStateController.getCustomerLatestWorkflow.bind(workflowStateController));

// Transition workflow to next step
router.post("/transition/:quoteId", workflowStateController.transitionWorkflow.bind(workflowStateController));

// Get pending actions for current user's role
router.get("/pending-actions", workflowStateController.getPendingActionsForRole.bind(workflowStateController));

// Purchase Panel: Handle C2 - Accept/Reject with Flow branching
router.post("/purchase-accept-reject/:quoteId", 
  authorizeRoles("purchase_support"), 
  workflowStateController.handlePurchaseAcceptReject.bind(workflowStateController)
);

export default router;
