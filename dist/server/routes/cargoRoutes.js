"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cargoController_1 = require("../controllers/cargoController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertCargoDispatchSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    itemDescription: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    weight: zod_1.z.number().optional(),
    dimensions: zod_1.z.string().optional(),
    specialHandling: zod_1.z.string().optional(),
    status: zod_1.z.enum(["submitted", "approved", "processing", "completed"]).default("submitted"),
    approvedBy: zod_1.z.string().optional(),
});
router.use(auth_1.authenticateToken);
router.get("/", cargoController_1.cargoController.getCargoDispatches);
router.get("/:id", cargoController_1.cargoController.getCargoDispatchById);
router.post("/", (0, validation_1.validateRequest)(insertCargoDispatchSchema), cargoController_1.cargoController.createCargoDispatch);
router.put("/:id", cargoController_1.cargoController.updateCargoDispatch);
router.get("/status/submitted", cargoController_1.cargoController.getSubmittedCargo);
router.get("/status/approved", cargoController_1.cargoController.getApprovedCargo);
router.get("/status/processing", cargoController_1.cargoController.getProcessingCargo);
router.get("/status/completed", cargoController_1.cargoController.getCompletedCargo);
router.get("/booking/:bookingId", cargoController_1.cargoController.getCargoByBooking);
router.post("/:id/approve", (0, auth_1.authorizeRoles)("supervisor", "admin"), cargoController_1.cargoController.approveCargo);
router.post("/:id/reject", (0, auth_1.authorizeRoles)("supervisor", "admin"), cargoController_1.cargoController.rejectCargo);
router.post("/:id/process", (0, auth_1.authorizeRoles)("warehouse", "supervisor", "admin"), cargoController_1.cargoController.processCargo);
router.post("/:id/complete", (0, auth_1.authorizeRoles)("warehouse", "supervisor", "admin"), cargoController_1.cargoController.completeCargo);
exports.default = router;
//# sourceMappingURL=cargoRoutes.js.map