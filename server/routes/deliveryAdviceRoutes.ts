import { Router } from "express";
import { deliveryAdviceController } from "../controllers/deliveryAdviceController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Delivery Advice Management Routes
router.post("/", 
  authorizeRoles("supervisor"), 
  deliveryAdviceController.createDeliveryAdvice
);

router.get("/", 
  authorizeRoles("customer", "supervisor", "admin"), 
  deliveryAdviceController.getDeliveryAdvices
);

router.get("/:id", 
  authorizeRoles("customer", "supervisor", "admin"), 
  deliveryAdviceController.getDeliveryAdviceById
);

router.patch("/:id", 
  authorizeRoles("supervisor", "admin"), 
  deliveryAdviceController.updateDeliveryAdvice
);

router.get("/booking/:bookingId", 
  authorizeRoles("customer", "supervisor", "admin"), 
  deliveryAdviceController.getDeliveryAdvicesByBooking
);

export default router;