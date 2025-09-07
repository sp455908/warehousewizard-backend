import { Router } from "express";
import { rfqController } from "../controllers/rfqController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// RFQ Management Routes
router.post("/", 
  authorizeRoles("purchase_support"), 
  rfqController.createRFQ
);

router.get("/", 
  authorizeRoles("purchase_support", "sales_support", "supervisor", "warehouse", "admin"), 
  rfqController.getRFQs
);

router.get("/:id", 
  authorizeRoles("purchase_support", "sales_support", "supervisor", "warehouse", "admin"), 
  rfqController.getRFQById
);

router.post("/:id/rate", 
  authorizeRoles("warehouse"), 
  rfqController.submitRate
);

router.patch("/:id/status", 
  authorizeRoles("purchase_support", "warehouse", "admin"), 
  rfqController.updateRFQStatus
);

router.get("/:id/rates", 
  authorizeRoles("purchase_support", "sales_support", "supervisor", "admin"), 
  rfqController.getRatesByRFQ
);

router.post("/:id/select-rate", 
  authorizeRoles("purchase_support"), 
  rfqController.selectRate
);

// Warehouse Panel: Accept/Reject RFQ requests (A5-A8)
router.post("/:id/accept", 
  authorizeRoles("warehouse"), 
  rfqController.acceptRFQ
);

router.post("/:id/reject", 
  authorizeRoles("warehouse"), 
  rfqController.rejectRFQ
);

export default router;