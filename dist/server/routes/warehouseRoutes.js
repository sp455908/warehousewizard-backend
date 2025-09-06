"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const warehouseController_1 = require("../controllers/warehouseController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const insertWarehouseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
    city: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
    storageType: zod_1.z.enum(["domestic_dry", "domestic_reefer", "bonded_dry", "bonded_reefer", "cfs_import", "cfs_export_dry", "cfs_export_reefer"]),
    totalSpace: zod_1.z.number().positive(),
    availableSpace: zod_1.z.number().positive(),
    pricePerSqFt: zod_1.z.number().positive(),
    features: zod_1.z.any().optional(),
    isActive: zod_1.z.boolean().default(true),
});
const updateWarehouseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    location: zod_1.z.string().min(1).optional(),
    city: zod_1.z.string().min(1).optional(),
    state: zod_1.z.string().min(1).optional(),
    storageType: zod_1.z.enum(["domestic_dry", "domestic_reefer", "bonded_dry", "bonded_reefer", "cfs_import", "cfs_export_dry", "cfs_export_reefer"]).optional(),
    totalSpace: zod_1.z.number().positive().optional(),
    availableSpace: zod_1.z.number().positive().optional(),
    pricePerSqFt: zod_1.z.number().positive().optional(),
    features: zod_1.z.any().optional(),
    isActive: zod_1.z.boolean().optional(),
    imageUrl: zod_1.z.string().optional(),
});
router.get("/", warehouseController_1.warehouseController.getAllWarehouses);
router.get("/search", warehouseController_1.warehouseController.searchWarehouses);
router.get("/types", warehouseController_1.warehouseController.getWarehouseTypes);
router.get("/type/:type", warehouseController_1.warehouseController.getWarehousesByType);
router.get("/location/:city/:state", warehouseController_1.warehouseController.getWarehousesByLocation);
router.get("/:id", warehouseController_1.warehouseController.getWarehouseById);
router.use(auth_1.authenticateToken);
router.post("/:id/check-availability", warehouseController_1.warehouseController.checkAvailability);
router.post("/", (0, auth_1.authorizeRoles)("admin", "warehouse", "supervisor"), (0, validation_1.validateRequest)(insertWarehouseSchema), warehouseController_1.warehouseController.createWarehouse);
router.put("/:id", (0, auth_1.authorizeRoles)("admin", "warehouse", "supervisor"), warehouseController_1.warehouseController.updateWarehouse);
router.patch("/:id", (0, auth_1.authorizeRoles)("admin", "warehouse", "supervisor"), (0, validation_1.validateRequest)(updateWarehouseSchema), warehouseController_1.warehouseController.updateWarehouse);
router.delete("/:id", (0, auth_1.authorizeRoles)("admin"), warehouseController_1.warehouseController.deleteWarehouse);
exports.default = router;
//# sourceMappingURL=warehouseRoutes.js.map