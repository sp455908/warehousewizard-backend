import { Router } from "express";
import { invoiceController } from "../controllers/invoiceController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { insertInvoiceSchema } from "@shared/schema";

const router = Router();

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

// Generate invoice PDF
router.get("/:id/pdf", invoiceController.generateInvoicePDF);

export default router;