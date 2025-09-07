import { Response, Router } from "express";
import { quoteController } from "../controllers/quoteController";
import { AuthenticatedRequest, authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { quoteLimiter } from "../middleware/rateLimiter";
import { z } from "zod";

const router = Router();

const insertQuoteSchema = z.object({
  customerId: z.string(),
  storageType: z.string().min(1),
  requiredSpace: z.number().positive(),
  preferredLocation: z.string().min(1),
  duration: z.string().min(1),
  specialRequirements: z.string().optional(),
  status: z.enum(["pending", "processing", "quoted", "approved", "rejected"]).default("pending"),
  assignedTo: z.string().optional(),
  finalPrice: z.number().optional(),
  warehouseId: z.string().optional(),
});

// Schema for specialized forms (domestic dry, bonded, CFS, etc.)
const specializedQuoteSchema = z.object({
  customerId: z.string(),
  formType: z.string().min(1),
  warehouseId: z.string().optional(),
}).passthrough();

// All quote routes require authentication
router.use(authenticateToken);

// Customer routes
router.post(
  "/",
  (req: AuthenticatedRequest, res: Response, next) => {
    console.log("[DEBUG] POST /api/quotes req.user:", req.user);
    console.log("[DEBUG] POST /api/quotes req.body:", req.body);
    next();
  },
  quoteLimiter,
  // Inject customerId from req.user into req.body before validation
  (req: AuthenticatedRequest, res: Response, next) => {
    if (req.user && req.user.id) {
      req.body.customerId = req.user.id;
    }
    next();
  },
  // Use different validation based on form type
  (req: AuthenticatedRequest, res: Response, next) => {
    if (req.body.formType) {
      // Specialized form - use flexible schema
      return validateRequest(specializedQuoteSchema)(req, res, next);
    } else {
      // Basic form - use strict schema
      return validateRequest(insertQuoteSchema)(req, res, next);
    }
  },
  quoteController.createQuote
);

router.get("/", quoteController.getQuotes);
router.get("/role-specific", quoteController.getQuotesForRole);
router.get("/:id", quoteController.getQuoteById);
router.get("/:id/calculate-price", quoteController.calculateQuotePrice);

// Status-specific routes for different roles
router.get(
  "/status/pending",
  authorizeRoles("purchase_support", "admin", "supervisor"),
  quoteController.getPendingQuotes
);

router.get(
  "/status/processing",
  authorizeRoles("sales_support", "admin", "supervisor"),
  quoteController.getProcessingQuotes
);

router.get(
  "/status/quoted",
  authorizeRoles("supervisor", "admin", "customer"),
  quoteController.getQuotedQuotes
);

// Update quote (various roles can update different fields)
router.put("/:id", quoteController.updateQuote);

// Purchase support actions
router.post(
  "/:id/assign",
  authorizeRoles("purchase_support", "admin"),
  quoteController.assignQuote
);

// Customer actions
router.post(
  "/:id/confirm",
  authorizeRoles("customer"),
  quoteController.confirmQuote
);

// Sales support and supervisor actions
router.post(
  "/:id/approve",
  authorizeRoles("sales_support", "supervisor", "admin"),
  quoteController.approveQuote
);

router.post(
  "/:id/reject",
  authorizeRoles("sales_support", "supervisor", "admin"),
  quoteController.rejectQuote
);

// Customer quote confirmation
router.post(
  "/:id/confirm-by-customer",
  authorizeRoles("customer"),
  quoteController.confirmQuoteByCustomer
);

// Sales rate editing
router.put(
  "/:id/edit-rate",
  authorizeRoles("sales_support", "admin"),
  quoteController.editQuoteRate
);

// Purchase Panel: Accept/Reject warehouse quotes (A2-A3)
router.post(
  "/:id/accept-warehouse-quote",
  authorizeRoles("purchase_support", "admin"),
  quoteController.acceptWarehouseQuote
);

router.post(
  "/:id/reject-warehouse-quote",
  authorizeRoles("purchase_support", "admin"),
  quoteController.rejectWarehouseQuote
);

// Purchase Panel: Assign warehouse to sales (A9-A10)
router.post(
  "/:id/assign-to-sales",
  authorizeRoles("purchase_support", "admin"),
  quoteController.assignWarehouseToSales
);

export default router;