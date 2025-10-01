import { Router } from "express";
import { invoiceRequestController } from "../controllers/invoiceRequestController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Customer routes
router.post("/", authorizeRoles("customer"), invoiceRequestController.createInvoiceRequest);
router.get("/customer", authorizeRoles("customer"), invoiceRequestController.getCustomerInvoices);
router.post("/:id/payment", authorizeRoles("customer"), invoiceRequestController.submitPaymentDetails);

// Warehouse routes
router.get("/", authorizeRoles("warehouse"), invoiceRequestController.getAllInvoices);
router.post("/:id/approve", authorizeRoles("warehouse"), invoiceRequestController.approveInvoiceRequest);
router.post("/:id/reject", authorizeRoles("warehouse"), invoiceRequestController.rejectInvoiceRequest);

// Common routes
router.get("/:id", invoiceRequestController.getInvoiceById);

export default router;

