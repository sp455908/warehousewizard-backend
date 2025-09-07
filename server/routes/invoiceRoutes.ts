import { Router } from "express";
import { invoiceController } from "../controllers/invoiceController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertInvoiceSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  invoiceNumber: z.string().min(1),
  amount: z.number().positive(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  dueDate: z.string().transform(str => new Date(str)),
  paidAt: z.string().transform(str => new Date(str)).optional(),
});

// All invoice routes require authentication
router.use(authenticateToken);

// General routes
router.get("/", invoiceController.getInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.put("/:id", invoiceController.updateInvoice);

// Accounts-only routes
router.post("/", authorizeRoles("accounts", "admin"), validateRequest(insertInvoiceSchema), invoiceController.createInvoice);
router.delete("/:id", authorizeRoles("accounts", "admin"), invoiceController.deleteInvoice);

// Status-specific routes
router.get("/status/draft", authorizeRoles("accounts", "admin"), invoiceController.getDraftInvoices);
router.get("/status/sent", invoiceController.getSentInvoices);
router.get("/status/paid", invoiceController.getPaidInvoices);
router.get("/status/overdue", invoiceController.getOverdueInvoices);

// Invoice actions
router.post("/:id/send", authorizeRoles("accounts", "admin"), invoiceController.sendInvoice);
router.post("/:id/mark-paid", authorizeRoles("accounts", "admin"), invoiceController.markAsPaid);
router.post("/:id/mark-overdue", authorizeRoles("accounts", "admin"), invoiceController.markAsOverdue);

// Customer payment
router.post("/:id/pay", authorizeRoles("customer"), invoiceController.payInvoice);

// Customer invoice request
router.post("/request", authorizeRoles("customer"), invoiceController.requestInvoice);

// Customer payment detail submission
router.post("/:id/submit-payment", authorizeRoles("customer"), invoiceController.submitPaymentDetails);

// Generate invoice PDF
router.get("/:id/pdf", invoiceController.generateInvoicePDF);

// Warehouse: Accept/Reject invoice requests (A29-A30)
router.post("/:id/accept", authorizeRoles("warehouse", "admin"), invoiceController.acceptInvoiceRequest);
router.post("/:id/reject", authorizeRoles("warehouse", "admin"), invoiceController.rejectInvoiceRequest);

export default router;