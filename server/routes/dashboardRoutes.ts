import { Router } from "express";
import { dashboardController } from "../controllers/dashboardController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

// All dashboard routes require authentication
router.use(authenticateToken);

// General dashboard stats
router.get("/stats", dashboardController.getDashboardStats.bind(dashboardController));

// Role-specific dashboard data
router.get("/customer", authorizeRoles("customer"), dashboardController.getCustomerDashboard.bind(dashboardController));
router.get("/purchase-support", authorizeRoles("purchase_support"), dashboardController.getPurchaseSupportDashboard.bind(dashboardController));
router.get("/sales-support", authorizeRoles("sales_support"), dashboardController.getSalesSupportDashboard.bind(dashboardController));
router.get("/warehouse", authorizeRoles("warehouse"), dashboardController.getWarehouseDashboard.bind(dashboardController));
router.get("/supervisor", authorizeRoles("supervisor"), dashboardController.getSupervisorDashboard.bind(dashboardController));
router.get("/accounts", authorizeRoles("accounts"), dashboardController.getAccountsDashboard.bind(dashboardController));
router.get("/admin", authorizeRoles("admin"), dashboardController.getAdminDashboard.bind(dashboardController));

// Recent activities
router.get("/activities", dashboardController.getRecentActivities.bind(dashboardController));

// Analytics endpoints
router.get("/analytics/quotes", dashboardController.getQuoteAnalytics.bind(dashboardController));
router.get("/analytics/bookings", dashboardController.getBookingAnalytics.bind(dashboardController));
router.get("/analytics/revenue", authorizeRoles("accounts", "admin"), dashboardController.getRevenueAnalytics.bind(dashboardController));

export default router;