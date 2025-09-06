"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingController_1 = require("../controllers/bookingController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertBookingSchema = zod_1.z.object({
    quoteId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    warehouseId: zod_1.z.string(),
    status: zod_1.z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).default("pending"),
    startDate: zod_1.z.string().transform(str => new Date(str)),
    endDate: zod_1.z.string().transform(str => new Date(str)),
    totalAmount: zod_1.z.number().positive(),
    approvedBy: zod_1.z.string().optional(),
});
router.use(auth_1.authenticateToken);
router.get("/", bookingController_1.bookingController.getBookings);
router.get("/:id", bookingController_1.bookingController.getBookingById);
router.post("/", (0, validation_1.validateRequest)(insertBookingSchema), bookingController_1.bookingController.createBooking);
router.get("/status/pending", (0, auth_1.authorizeRoles)("supervisor", "admin"), bookingController_1.bookingController.getPendingBookings);
router.get("/status/confirmed", bookingController_1.bookingController.getConfirmedBookings);
router.get("/status/active", bookingController_1.bookingController.getActiveBookings);
router.get("/status/completed", bookingController_1.bookingController.getCompletedBookings);
router.post("/:id/confirm", (0, auth_1.authorizeRoles)("supervisor", "admin"), bookingController_1.bookingController.confirmBooking);
router.post("/:id/cancel", (0, auth_1.authorizeRoles)("supervisor", "admin", "customer"), bookingController_1.bookingController.cancelBooking);
router.put("/:id", bookingController_1.bookingController.updateBooking);
router.post("/:id/approve", (0, auth_1.authorizeRoles)("customer"), bookingController_1.bookingController.approveBooking);
router.post("/:id/reject", (0, auth_1.authorizeRoles)("customer"), bookingController_1.bookingController.rejectBooking);
exports.default = router;
//# sourceMappingURL=bookingRoutes.js.map