"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deliveryController_1 = require("../controllers/deliveryController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertDeliveryRequestSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    deliveryAddress: zod_1.z.string().min(1),
    preferredDate: zod_1.z.string().transform(str => new Date(str)),
    urgency: zod_1.z.enum(["standard", "express", "urgent"]).default("standard"),
    status: zod_1.z.enum(["requested", "scheduled", "in_transit", "delivered"]).default("requested"),
    assignedDriver: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
});
router.use(auth_1.authenticateToken);
router.get("/", deliveryController_1.deliveryController.getDeliveryRequests);
router.get("/:id", deliveryController_1.deliveryController.getDeliveryRequestById);
router.post("/", (0, validation_1.validateRequest)(insertDeliveryRequestSchema), deliveryController_1.deliveryController.createDeliveryRequest);
router.put("/:id", deliveryController_1.deliveryController.updateDeliveryRequest);
router.get("/status/requested", deliveryController_1.deliveryController.getRequestedDeliveries);
router.get("/status/scheduled", deliveryController_1.deliveryController.getScheduledDeliveries);
router.get("/status/in-transit", deliveryController_1.deliveryController.getInTransitDeliveries);
router.get("/status/delivered", deliveryController_1.deliveryController.getDeliveredDeliveries);
router.post("/:id/schedule", (0, auth_1.authorizeRoles)("supervisor", "admin"), deliveryController_1.deliveryController.scheduleDelivery);
router.post("/:id/assign-driver", (0, auth_1.authorizeRoles)("supervisor", "admin"), deliveryController_1.deliveryController.assignDriver);
router.post("/:id/dispatch", (0, auth_1.authorizeRoles)("warehouse", "supervisor", "admin"), deliveryController_1.deliveryController.dispatchDelivery);
router.post("/:id/complete", (0, auth_1.authorizeRoles)("warehouse", "supervisor", "admin"), deliveryController_1.deliveryController.completeDelivery);
router.get("/:id/track", deliveryController_1.deliveryController.trackDelivery);
exports.default = router;
//# sourceMappingURL=deliveryRoutes.js.map