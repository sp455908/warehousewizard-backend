import { Router } from "express";
import { deliveryController } from "../controllers/deliveryController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertDeliveryRequestSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  deliveryAddress: z.string().min(1),
  preferredDate: z.string().transform(str => new Date(str)),
  urgency: z.enum(["standard", "express", "urgent"]).default("standard"),
  status: z.enum(["requested", "scheduled", "in_transit", "delivered"]).default("requested"),
  assignedDriver: z.string().optional(),
  trackingNumber: z.string().optional(),
});

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

// Supervisor: Approve/Reject delivery requests (A26-A27)
router.post("/:id/approve", authorizeRoles("supervisor", "admin"), deliveryController.approveDeliveryRequest);
router.post("/:id/reject", authorizeRoles("supervisor", "admin"), deliveryController.rejectDeliveryRequest);

export default router;