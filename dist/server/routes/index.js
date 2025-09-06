"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const warehouseRoutes_1 = __importDefault(require("./warehouseRoutes"));
const quoteRoutes_1 = __importDefault(require("./quoteRoutes"));
const bookingRoutes_1 = __importDefault(require("./bookingRoutes"));
const cargoRoutes_1 = __importDefault(require("./cargoRoutes"));
const deliveryRoutes_1 = __importDefault(require("./deliveryRoutes"));
const invoiceRoutes_1 = __importDefault(require("./invoiceRoutes"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const rolesRoutes_1 = __importDefault(require("./rolesRoutes"));
const settingsRoutes_1 = __importDefault(require("./settingsRoutes"));
const router = (0, express_1.Router)();
router.use("/auth", authRoutes_1.default);
router.use("/warehouses", warehouseRoutes_1.default);
router.use("/quotes", quoteRoutes_1.default);
router.use("/bookings", bookingRoutes_1.default);
router.use("/cargo", cargoRoutes_1.default);
router.use("/delivery", deliveryRoutes_1.default);
router.use("/invoices", invoiceRoutes_1.default);
router.use("/users", userRoutes_1.default);
router.use("/dashboard", dashboardRoutes_1.default);
router.use("/roles", rolesRoutes_1.default);
router.use("/settings", settingsRoutes_1.default);
router.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
    });
});
exports.default = router;
//# sourceMappingURL=index.js.map