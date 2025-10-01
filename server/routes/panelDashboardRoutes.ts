import { Router } from "express";
import { panelDashboardController } from "../controllers/panelDashboardController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All panel dashboard routes require authentication
router.use(authenticateToken);

// Get role-specific dashboard
router.get("/", panelDashboardController.getRoleDashboard.bind(panelDashboardController));

// Individual panel dashboards (for specific access if needed)
router.get("/customer", 
  authorizeRoles("customer"), 
  panelDashboardController.getCustomerDashboard.bind(panelDashboardController)
);

router.get("/purchase", 
  authorizeRoles("purchase_support"), 
  panelDashboardController.getPurchaseDashboard.bind(panelDashboardController)
);

router.get("/warehouse", 
  authorizeRoles("warehouse"), 
  panelDashboardController.getWarehouseDashboard.bind(panelDashboardController)
);

router.get("/sales", 
  authorizeRoles("sales_support"), 
  panelDashboardController.getSalesDashboard.bind(panelDashboardController)
);

router.get("/supervisor", 
  authorizeRoles("supervisor"), 
  panelDashboardController.getSupervisorDashboard.bind(panelDashboardController)
);

export default router;
