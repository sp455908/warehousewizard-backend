import { Router } from "express";
import { deliveryOrderController } from "../controllers/deliveryOrderController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Supervisor routes
router.post("/", authorizeRoles("supervisor"), deliveryOrderController.createDeliveryOrder);
router.get("/", authorizeRoles("supervisor"), deliveryOrderController.getAllDeliveryOrders);

// Warehouse routes
router.get("/warehouse", authorizeRoles("warehouse"), deliveryOrderController.getWarehouseDeliveryOrders);
router.patch("/:id/status", authorizeRoles("warehouse"), deliveryOrderController.updateDeliveryOrderStatus);

// Common routes
router.get("/:id", deliveryOrderController.getDeliveryOrderById);

export default router;