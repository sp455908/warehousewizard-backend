import { Response, Router } from "express";
import { quoteController } from "../controllers/quoteController";
import { AuthenticatedRequest, authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { insertQuoteSchema } from "../../shared/schema";
import { quoteLimiter } from "../middleware/rateLimiter";

const router = Router();

// All quote routes require authenticationfix 
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
    if (req.user && (req.user as any)._id) {
      req.body.customerId = (req.user as any)._id.toString();
    }
    next();
  },
  validateRequest(insertQuoteSchema),
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

export default router;