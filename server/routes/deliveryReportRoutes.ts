import { Router } from "express";
import { deliveryReportController } from "../controllers/deliveryReportController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Delivery Report Management Routes
router.post("/", 
  authorizeRoles("warehouse"), 
  deliveryReportController.createDeliveryReport
);

router.get("/", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryReportController.getDeliveryReports
);

router.get("/:id", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryReportController.getDeliveryReportById
);

router.patch("/:id", 
  authorizeRoles("warehouse", "admin"), 
  deliveryReportController.updateDeliveryReport
);

router.get("/booking/:bookingId", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryReportController.getDeliveryReportsByBooking
);

router.get("/delivery-order/:deliveryOrderId", 
  authorizeRoles("customer", "supervisor", "warehouse", "admin"), 
  deliveryReportController.getDeliveryReportsByDeliveryOrder
);

export default router;