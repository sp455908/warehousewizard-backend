import { Router } from "express";
import { bookingController } from "../controllers/bookingController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { insertBookingSchema } from "../../shared/schema";

const router = Router();

// All booking routes require authentication
router.use(authenticateToken);

// Customer and general routes
router.get("/", bookingController.getBookings);
router.get("/:id", bookingController.getBookingById);
router.post("/", validateRequest(insertBookingSchema), bookingController.createBooking);

// Status-specific routes
router.get("/status/pending", authorizeRoles("supervisor", "admin"), bookingController.getPendingBookings);
router.get("/status/confirmed", bookingController.getConfirmedBookings);
router.get("/status/active", bookingController.getActiveBookings);
router.get("/status/completed", bookingController.getCompletedBookings);

// Supervisor actions
router.post("/:id/confirm", authorizeRoles("supervisor", "admin"), bookingController.confirmBooking);
router.post("/:id/cancel", authorizeRoles("supervisor", "admin", "customer"), bookingController.cancelBooking);

// Update booking
router.put("/:id", bookingController.updateBooking);

// Customer approval
router.post("/:id/approve", authorizeRoles("customer"), bookingController.approveBooking);
router.post("/:id/reject", authorizeRoles("customer"), bookingController.rejectBooking);

export default router;