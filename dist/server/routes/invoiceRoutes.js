"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoiceController_1 = require("../controllers/invoiceController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertInvoiceSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    invoiceNumber: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    status: zod_1.z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
    dueDate: zod_1.z.string().transform(str => new Date(str)),
    paidAt: zod_1.z.string().transform(str => new Date(str)).optional(),
});
router.use(auth_1.authenticateToken);
router.get("/", invoiceController_1.invoiceController.getInvoices);
router.get("/:id", invoiceController_1.invoiceController.getInvoiceById);
router.put("/:id", invoiceController_1.invoiceController.updateInvoice);
router.post("/", (0, auth_1.authorizeRoles)("accounts", "admin"), (0, validation_1.validateRequest)(insertInvoiceSchema), invoiceController_1.invoiceController.createInvoice);
router.delete("/:id", (0, auth_1.authorizeRoles)("accounts", "admin"), invoiceController_1.invoiceController.deleteInvoice);
router.get("/status/draft", (0, auth_1.authorizeRoles)("accounts", "admin"), invoiceController_1.invoiceController.getDraftInvoices);
router.get("/status/sent", invoiceController_1.invoiceController.getSentInvoices);
router.get("/status/paid", invoiceController_1.invoiceController.getPaidInvoices);
router.get("/status/overdue", invoiceController_1.invoiceController.getOverdueInvoices);
router.post("/:id/send", (0, auth_1.authorizeRoles)("accounts", "admin"), invoiceController_1.invoiceController.sendInvoice);
router.post("/:id/mark-paid", (0, auth_1.authorizeRoles)("accounts", "admin"), invoiceController_1.invoiceController.markAsPaid);
router.post("/:id/mark-overdue", (0, auth_1.authorizeRoles)("accounts", "admin"), invoiceController_1.invoiceController.markAsOverdue);
router.post("/:id/pay", (0, auth_1.authorizeRoles)("customer"), invoiceController_1.invoiceController.payInvoice);
router.get("/:id/pdf", invoiceController_1.invoiceController.generateInvoicePDF);
exports.default = router;
//# sourceMappingURL=invoiceRoutes.js.map