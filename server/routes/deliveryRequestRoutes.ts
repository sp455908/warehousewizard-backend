import { Router } from "express";
import { deliveryRequestController } from "../controllers/deliveryRequestController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Customer routes
router.post("/", authorizeRoles("customer"), deliveryRequestController.createDeliveryRequest);
router.get("/customer", authorizeRoles("customer"), deliveryRequestController.getCustomerDeliveryRequests);

// Supervisor routes
router.get("/", authorizeRoles("supervisor"), deliveryRequestController.getAllDeliveryRequests);
router.post("/:id/approve", authorizeRoles("supervisor"), deliveryRequestController.approveDeliveryRequest);
router.post("/:id/reject", authorizeRoles("supervisor"), deliveryRequestController.rejectDeliveryRequest);

// Common routes
router.get("/:id", deliveryRequestController.getDeliveryRequestById);

export default router;

