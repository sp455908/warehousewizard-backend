import { Router } from "express";
import { warehouseController } from "../controllers/warehouseController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { insertWarehouseSchema } from "../../shared/schema";

const router = Router();

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

router.delete(
  "/:id",
  authorizeRoles("admin"),
  warehouseController.deleteWarehouse
);

export default router;