import { Router } from "express";
import { dashboardController } from "../controllers/dashboardController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All dashboard routes require authentication
router.use(authenticateToken);

// General dashboard stats
router.get("/stats", dashboardController.getDashboardStats);

// Role-specific dashboard data
router.get("/customer", authorizeRoles("customer"), dashboardController.getCustomerDashboard);
router.get("/purchase-support", authorizeRoles("purchase_support"), dashboardController.getPurchaseSupportDashboard);
router.get("/sales-support", authorizeRoles("sales_support"), dashboardController.getSalesSupportDashboard);
router.get("/warehouse", authorizeRoles("warehouse"), dashboardController.getWarehouseDashboard);
router.get("/supervisor", authorizeRoles("supervisor"), dashboardController.getSupervisorDashboard);
router.get("/accounts", authorizeRoles("accounts"), dashboardController.getAccountsDashboard);
router.get("/admin", authorizeRoles("admin"), dashboardController.getAdminDashboard);

// Recent activities
router.get("/activities", dashboardController.getRecentActivities);

// Analytics endpoints
router.get("/analytics/quotes", dashboardController.getQuoteAnalytics);
router.get("/analytics/bookings", dashboardController.getBookingAnalytics);
router.get("/analytics/revenue", authorizeRoles("accounts", "admin"), dashboardController.getRevenueAnalytics);

export default router;