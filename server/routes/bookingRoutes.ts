import { Router } from "express";
import { bookingController } from "../controllers/bookingController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertBookingSchema = z.object({
  quoteId: z.string(),
  customerId: z.string(),
  warehouseId: z.string(),
  status: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).default("pending"),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  totalAmount: z.number().positive(),
  approvedBy: z.string().optional(),
});

// All booking routes require authentication
router.use(authenticateToken);

// Customer and general routes
router.get("/", bookingController.getBookings);
router.get("/requests", bookingController.getBookingRequests);
router.get("/:id", bookingController.getBookingById);
router.post("/", validateRequest(insertBookingSchema), bookingController.createBooking);
router.post("/requests/:id/process", bookingController.processQuoteRequest);

// Status-specific routes
router.get("/status/pending", authorizeRoles("supervisor", "admin"), bookingController.getPendingBookings);
router.get("/status/confirmed", bookingController.getConfirmedBookings);
router.get("/status/active", bookingController.getActiveBookings);
router.get("/status/completed", bookingController.getCompletedBookings);

// Supervisor actions
router.post("/:id/confirm", authorizeRoles("supervisor", "admin"), bookingController.confirmBooking);
router.post("/:id/cancel", authorizeRoles("supervisor", "admin", "customer"), bookingController.cancelBooking);

// Supervisor booking approval/rejection
router.post("/:id/approve-by-supervisor", authorizeRoles("supervisor", "admin"), bookingController.approveBookingBySupervisor);
router.post("/:id/reject-by-supervisor", authorizeRoles("supervisor", "admin"), bookingController.rejectBookingBySupervisor);

// Update booking
router.put("/:id", bookingController.updateBooking);

// Customer approval
router.post("/:id/approve", authorizeRoles("customer"), bookingController.approveBooking);
router.post("/:id/reject", authorizeRoles("customer"), bookingController.rejectBooking);

export default router;