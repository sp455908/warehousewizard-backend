import { Router } from "express";
import { cargoController } from "../controllers/cargoController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertCargoDispatchSchema = z.object({
  bookingId: z.string(),
  itemDescription: z.string().min(1),
  quantity: z.number().positive(),
  weight: z.number().optional(),
  dimensions: z.string().optional(),
  specialHandling: z.string().optional(),
  status: z.enum(["submitted", "approved", "processing", "completed"]).default("submitted"),
  approvedBy: z.string().optional(),
});

// All cargo routes require authentication
router.use(authenticateToken);

// General routes
router.get("/", cargoController.getCargoDispatches);
router.get("/:id", cargoController.getCargoDispatchById);
router.post("/", validateRequest(insertCargoDispatchSchema), cargoController.createCargoDispatch);
router.put("/:id", cargoController.updateCargoDispatch);

// Status-specific routes
router.get("/status/submitted", cargoController.getSubmittedCargo);
router.get("/status/approved", cargoController.getApprovedCargo);
router.get("/status/processing", cargoController.getProcessingCargo);
router.get("/status/completed", cargoController.getCompletedCargo);

// Booking-specific routes
router.get("/booking/:bookingId", cargoController.getCargoByBooking);

// Supervisor actions
router.post("/:id/approve", authorizeRoles("supervisor", "admin"), cargoController.approveCargo);
router.post("/:id/reject", authorizeRoles("supervisor", "admin"), cargoController.rejectCargo);

// Warehouse actions
router.post("/:id/process", authorizeRoles("warehouse", "supervisor", "admin"), cargoController.processCargo);
router.post("/:id/complete", authorizeRoles("warehouse", "supervisor", "admin"), cargoController.completeCargo);

export default router;