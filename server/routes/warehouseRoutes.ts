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
  storageType: z.enum(["cold_storage", "dry_storage", "hazmat", "climate_controlled"]),
  totalSpace: z.number().positive(),
  availableSpace: z.number().positive(),
  pricePerSqFt: z.number().positive(),
  features: z.any().optional(),
  isActive: z.boolean().default(true),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  storageType: z.enum(["cold_storage", "dry_storage", "hazmat", "climate_controlled"]).optional(),
  totalSpace: z.number().positive().optional(),
  availableSpace: z.number().positive().optional(),
  pricePerSqFt: z.number().positive().optional(),
  features: z.any().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().optional(),
});

// Public routes
router.get("/", warehouseController.getAllWarehouses);
router.get("/search", warehouseController.searchWarehouses);
router.get("/types", warehouseController.getWarehouseTypes);
router.get("/type/:type", warehouseController.getWarehousesByType);
router.get("/location/:city/:state", warehouseController.getWarehousesByLocation);
router.get("/:id", warehouseController.getWarehouseById);

// Protected routes
router.use(authenticateToken);

// Check availability (authenticated users only)
router.post("/:id/check-availability", warehouseController.checkAvailability);

// Admin and warehouse management routes
router.post(
  "/",
  authorizeRoles("admin", "warehouse", "supervisor"),
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

router.delete(
  "/:id",
  authorizeRoles("admin"),
  warehouseController.deleteWarehouse
);

export default router;