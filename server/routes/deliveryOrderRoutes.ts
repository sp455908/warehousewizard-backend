import { Router } from "express";
import { deliveryOrderController } from "../controllers/deliveryOrderController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Delivery Order Management Routes
router.post("/", 
  authorizeRoles("supervisor"), 
  deliveryOrderController.createDeliveryOrder
);

router.get("/", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryOrderController.getDeliveryOrders
);

router.get("/:id", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryOrderController.getDeliveryOrderById
);

router.patch("/:id", 
  authorizeRoles("supervisor", "admin"), 
  deliveryOrderController.updateDeliveryOrder
);

router.get("/booking/:bookingId", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryOrderController.getDeliveryOrdersByBooking
);

export default router;