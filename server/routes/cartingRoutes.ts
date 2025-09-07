import { Router } from "express";
import { cartingController } from "../controllers/cartingController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Carting Details Management Routes
router.post("/", 
  authorizeRoles("warehouse"), 
  cartingController.createCartingDetail
);

router.get("/", 
  authorizeRoles("supervisor", "warehouse", "admin"), 
  cartingController.getCartingDetails
);

router.get("/:id", 
  authorizeRoles("supervisor", "warehouse", "admin"), 
  cartingController.getCartingDetailById
);

router.patch("/:id", 
  authorizeRoles("warehouse", "admin"), 
  cartingController.updateCartingDetail
);

router.post("/:id/confirm", 
  authorizeRoles("supervisor"), 
  cartingController.confirmCartingDetail
);

router.post("/:id/reject", 
  authorizeRoles("supervisor"), 
  cartingController.rejectCartingDetail
);

router.get("/booking/:bookingId", 
  authorizeRoles("supervisor", "warehouse", "admin"), 
  cartingController.getCartingDetailsByBooking
);

export default router;