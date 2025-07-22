import { Router } from "express";
import { deliveryController } from "../controllers/deliveryController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { insertDeliveryRequestSchema } from "@shared/schema";

const router = Router();

// All delivery routes require authentication
router.use(authenticateToken);

// General routes
router.get("/", deliveryController.getDeliveryRequests);
router.get("/:id", deliveryController.getDeliveryRequestById);
router.post("/", validateRequest(insertDeliveryRequestSchema), deliveryController.createDeliveryRequest);
router.put("/:id", deliveryController.updateDeliveryRequest);

// Status-specific routes
router.get("/status/requested", deliveryController.getRequestedDeliveries);
router.get("/status/scheduled", deliveryController.getScheduledDeliveries);
router.get("/status/in-transit", deliveryController.getInTransitDeliveries);
router.get("/status/delivered", deliveryController.getDeliveredDeliveries);

// Supervisor actions
router.post("/:id/schedule", authorizeRoles("supervisor", "admin"), deliveryController.scheduleDelivery);
router.post("/:id/assign-driver", authorizeRoles("supervisor", "admin"), deliveryController.assignDriver);

// Warehouse actions
router.post("/:id/dispatch", authorizeRoles("warehouse", "supervisor", "admin"), deliveryController.dispatchDelivery);
router.post("/:id/complete", authorizeRoles("warehouse", "supervisor", "admin"), deliveryController.completeDelivery);

// Tracking
router.get("/:id/track", deliveryController.trackDelivery);

export default router;