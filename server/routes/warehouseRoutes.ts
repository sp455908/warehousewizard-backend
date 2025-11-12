import { Router } from "express";
import { warehouseController } from "../controllers/warehouseController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { z } from "zod";

const router = Router();

const insertWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  storageType: z.enum(["domestic_dry", "domestic_reefer", "bonded_dry", "bonded_reefer", "cfs_import", "cfs_export_dry", "cfs_export_reefer"]),
  totalSpace: z.number().positive(),
  availableSpace: z.number().positive(),
  pricePerSqFt: z.number().positive(),
  features: z.array(z.string()).optional().default([]),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  ownerId: z.string().optional(),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  storageType: z.enum(["domestic_dry", "domestic_reefer", "bonded_dry", "bonded_reefer", "cfs_import", "cfs_export_dry", "cfs_export_reefer"]).optional(),
  totalSpace: z.number().positive().optional(),
  availableSpace: z.number().positive().optional(),
  pricePerSqFt: z.number().positive().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().optional(),
});

// Public routes (no authentication required)
router.get("/", warehouseController.getAllWarehouses);
router.get("/search", warehouseController.searchWarehouses);
router.get("/types", warehouseController.getWarehouseTypes);
router.get("/type/:type", warehouseController.getWarehousesByType);
router.get("/location/:city/:state", warehouseController.getWarehousesByLocation);

// Protected routes (authentication required)
router.use(authenticateToken);

// Warehouse ownership routes (must come before /:id route)
router.get(
  "/my-warehouses",
  authorizeRoles("warehouse", "admin"),
  warehouseController.getMyWarehouses
);

// Check availability (authenticated users only)
router.post("/:id/check-availability", warehouseController.checkAvailability);

// Warehouse management routes (only warehouse owners can create)
router.post(
  "/",
  authorizeRoles("warehouse", "admin"),
  validateRequest(insertWarehouseSchema),
  warehouseController.createWarehouse
);

router.put(
  "/:id",
  authorizeRoles("admin", "warehouse", "supervisor"),
  warehouseController.updateWarehouse
);

router.patch(
  "/:id",
  authorizeRoles("admin", "warehouse", "supervisor"),
  validateRequest(updateWarehouseSchema),
  warehouseController.updateWarehouse
);

router.post(
  "/transfer-ownership",
  authorizeRoles("admin"),
  warehouseController.transferOwnership
);

router.get(
  "/owners",
  authorizeRoles("admin"),
  warehouseController.getWarehouseOwners
);

router.delete(
  "/:id",
  authorizeRoles("admin", "warehouse"),
  warehouseController.deleteWarehouse
);

// This route must come last to avoid conflicts with specific routes
router.get("/:id", warehouseController.getWarehouseById);

export default router;