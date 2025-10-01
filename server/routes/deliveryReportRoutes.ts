import { Router } from "express";
import { deliveryReportController } from "../controllers/deliveryReportController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Warehouse routes
router.post("/", authorizeRoles("warehouse"), deliveryReportController.createDeliveryReport);
router.get("/warehouse", authorizeRoles("warehouse"), deliveryReportController.getWarehouseDeliveryReports);
router.patch("/:id/status", authorizeRoles("warehouse"), deliveryReportController.updateDeliveryReportStatus);

// Supervisor routes
router.get("/", authorizeRoles("supervisor"), deliveryReportController.getAllDeliveryReports);

// Customer routes
router.get("/customer", authorizeRoles("customer"), deliveryReportController.getCustomerDeliveryReports);

// Common routes
router.get("/:id", deliveryReportController.getDeliveryReportById);

export default router;