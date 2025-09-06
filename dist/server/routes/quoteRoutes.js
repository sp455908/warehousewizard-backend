"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const quoteController_1 = require("../controllers/quoteController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertQuoteSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    storageType: zod_1.z.string().min(1),
    requiredSpace: zod_1.z.number().positive(),
    preferredLocation: zod_1.z.string().min(1),
    duration: zod_1.z.string().min(1),
    specialRequirements: zod_1.z.string().optional(),
    status: zod_1.z.enum(["pending", "processing", "quoted", "approved", "rejected"]).default("pending"),
    assignedTo: zod_1.z.string().optional(),
    finalPrice: zod_1.z.number().optional(),
    warehouseId: zod_1.z.string().optional(),
});
router.use(auth_1.authenticateToken);
router.post("/", (req, res, next) => {
    console.log("[DEBUG] POST /api/quotes req.user:", req.user);
    console.log("[DEBUG] POST /api/quotes req.body:", req.body);
    next();
}, rateLimiter_1.quoteLimiter, (req, res, next) => {
    if (req.user && req.user.id) {
        req.body.customerId = req.user.id;
    }
    next();
}, (0, validation_1.validateRequest)(insertQuoteSchema), quoteController_1.quoteController.createQuote);
router.get("/", quoteController_1.quoteController.getQuotes);
router.get("/role-specific", quoteController_1.quoteController.getQuotesForRole);
router.get("/:id", quoteController_1.quoteController.getQuoteById);
router.get("/:id/calculate-price", quoteController_1.quoteController.calculateQuotePrice);
router.get("/status/pending", (0, auth_1.authorizeRoles)("purchase_support", "admin", "supervisor"), quoteController_1.quoteController.getPendingQuotes);
router.get("/status/processing", (0, auth_1.authorizeRoles)("sales_support", "admin", "supervisor"), quoteController_1.quoteController.getProcessingQuotes);
router.get("/status/quoted", (0, auth_1.authorizeRoles)("supervisor", "admin", "customer"), quoteController_1.quoteController.getQuotedQuotes);
router.put("/:id", quoteController_1.quoteController.updateQuote);
router.post("/:id/assign", (0, auth_1.authorizeRoles)("purchase_support", "admin"), quoteController_1.quoteController.assignQuote);
router.post("/:id/approve", (0, auth_1.authorizeRoles)("sales_support", "supervisor", "admin"), quoteController_1.quoteController.approveQuote);
router.post("/:id/reject", (0, auth_1.authorizeRoles)("sales_support", "supervisor", "admin"), quoteController_1.quoteController.rejectQuote);
exports.default = router;
//# sourceMappingURL=quoteRoutes.js.map