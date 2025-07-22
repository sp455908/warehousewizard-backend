import { Router } from "express";
import warehouseRoutes from "./warehouseRoutes";
import quoteRoutes from "./quoteRoutes";
import bookingRoutes from "./bookingRoutes";
import cargoRoutes from "./cargoRoutes";
import deliveryRoutes from "./deliveryRoutes";
import invoiceRoutes from "./invoiceRoutes";
import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import dashboardRoutes from "./dashboardRoutes";

const router = Router();

// API routes
router.use("/auth", authRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/quotes", quoteRoutes);
router.use("/bookings", bookingRoutes);
router.use("/cargo", cargoRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/users", userRoutes);
router.use("/dashboard", dashboardRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;