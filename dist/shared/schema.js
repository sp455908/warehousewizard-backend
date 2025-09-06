"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertInvoiceSchema = exports.insertDeliveryRequestSchema = exports.insertCargoDispatchSchema = exports.insertBookingSchema = exports.insertQuoteSchema = exports.insertWarehouseSchema = exports.insertOtpSchema = exports.insertUserSchema = exports.InvoiceModel = exports.DeliveryRequestModel = exports.CargoDispatchDetailModel = exports.BookingModel = exports.QuoteModel = exports.WarehouseModel = exports.OtpVerificationModel = exports.UserModel = exports.userRoles = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const zod_1 = require("zod");
exports.userRoles = [
    "customer",
    "purchase_support",
    "sales_support",
    "supervisor",
    "warehouse",
    "accounts",
    "admin"
];
const userSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    mobile: { type: String },
    company: { type: String },
    role: { type: String, enum: exports.userRoles, default: "customer" },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },
}, { timestamps: true });
exports.UserModel = mongoose_1.default.model("User", userSchema);
const otpVerificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["email", "mobile"], required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false },
}, { timestamps: true });
exports.OtpVerificationModel = mongoose_1.default.model("OtpVerification", otpVerificationSchema);
const warehouseSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    storageType: {
        type: String,
        enum: ["domestic_dry", "domestic_reefer", "bonded_dry", "bonded_reefer", "cfs_import", "cfs_export_dry", "cfs_export_reefer"],
        required: true
    },
    totalSpace: { type: Number, required: true },
    availableSpace: { type: Number, required: true },
    pricePerSqFt: { type: Number, required: true },
    features: { type: mongoose_1.Schema.Types.Mixed },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
});
exports.WarehouseModel = mongoose_1.default.model("Warehouse", warehouseSchema);
const quoteSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    storageType: { type: String, required: true },
    requiredSpace: { type: Number, required: true },
    preferredLocation: { type: String, required: true },
    duration: { type: String, required: true },
    specialRequirements: { type: String },
    status: {
        type: String,
        enum: ["pending", "processing", "quoted", "approved", "rejected"],
        default: "pending"
    },
    assignedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    finalPrice: { type: Number },
    warehouseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Warehouse" },
}, { timestamps: true });
exports.QuoteModel = mongoose_1.default.model("Quote", quoteSchema);
const bookingSchema = new mongoose_1.Schema({
    quoteId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Quote", required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    warehouseId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    status: {
        type: String,
        enum: ["pending", "confirmed", "active", "completed", "cancelled"],
        default: "pending"
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
exports.BookingModel = mongoose_1.default.model("Booking", bookingSchema);
const cargoDispatchDetailSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Booking", required: true },
    itemDescription: { type: String, required: true },
    quantity: { type: Number, required: true },
    weight: { type: Number },
    dimensions: { type: String },
    specialHandling: { type: String },
    status: {
        type: String,
        enum: ["submitted", "approved", "processing", "completed"],
        default: "submitted"
    },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
exports.CargoDispatchDetailModel = mongoose_1.default.model("CargoDispatchDetail", cargoDispatchDetailSchema);
const deliveryRequestSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Booking", required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    deliveryAddress: { type: String, required: true },
    preferredDate: { type: Date, required: true },
    urgency: { type: String, enum: ["standard", "express", "urgent"], default: "standard" },
    status: {
        type: String,
        enum: ["requested", "scheduled", "in_transit", "delivered"],
        default: "requested"
    },
    assignedDriver: { type: String },
    trackingNumber: { type: String },
}, { timestamps: true });
exports.DeliveryRequestModel = mongoose_1.default.model("DeliveryRequest", deliveryRequestSchema);
const invoiceSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Booking", required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ["draft", "sent", "paid", "overdue", "cancelled"],
        default: "draft"
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
}, { timestamps: true });
exports.InvoiceModel = mongoose_1.default.model("Invoice", invoiceSchema);
exports.insertUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    mobile: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    role: zod_1.z.enum(exports.userRoles).default("customer"),
    isActive: zod_1.z.boolean().default(true),
    isEmailVerified: zod_1.z.boolean().default(false),
    isMobileVerified: zod_1.z.boolean().default(false),
});
exports.insertOtpSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    type: zod_1.z.enum(["email", "mobile"]),
    code: zod_1.z.string(),
    expiresAt: zod_1.z.date(),
    isUsed: zod_1.z.boolean().default(false),
});
exports.insertWarehouseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
    city: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
    storageType: zod_1.z.enum(["cold_storage", "dry_storage", "hazmat", "climate_controlled"]),
    totalSpace: zod_1.z.number().positive(),
    availableSpace: zod_1.z.number().positive(),
    pricePerSqFt: zod_1.z.number().positive(),
    features: zod_1.z.any().optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.insertQuoteSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    storageType: zod_1.z.string().min(1),
    requiredSpace: zod_1.z.number().positive(),
    preferredLocation: zod_1.z.string().min(1),
    duration: zod_1.z.string().min(1),
    specialRequirements: zod_1.z.string().optional(),
    status: zod_1.z.enum(["pending", "processing", "quoted", "approved", "rejected"]).default("pending"),
    assignedTo: zod_1.z.string().optional(),
    finalPrice: zod_1.z.number().optional(),
    warehouseId: zod_1.z.string().optional(),
});
exports.insertBookingSchema = zod_1.z.object({
    quoteId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    warehouseId: zod_1.z.string(),
    status: zod_1.z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).default("pending"),
    startDate: zod_1.z.date(),
    endDate: zod_1.z.date(),
    totalAmount: zod_1.z.number().positive(),
    approvedBy: zod_1.z.string().optional(),
});
exports.insertCargoDispatchSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    itemDescription: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    weight: zod_1.z.number().optional(),
    dimensions: zod_1.z.string().optional(),
    specialHandling: zod_1.z.string().optional(),
    status: zod_1.z.enum(["submitted", "approved", "processing", "completed"]).default("submitted"),
    approvedBy: zod_1.z.string().optional(),
});
exports.insertDeliveryRequestSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    deliveryAddress: zod_1.z.string().min(1),
    preferredDate: zod_1.z.date(),
    urgency: zod_1.z.enum(["standard", "express", "urgent"]).default("standard"),
    status: zod_1.z.enum(["requested", "scheduled", "in_transit", "delivered"]).default("requested"),
    assignedDriver: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
});
exports.insertInvoiceSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    invoiceNumber: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    status: zod_1.z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
    dueDate: zod_1.z.date(),
    paidAt: zod_1.z.date().optional(),
});
//# sourceMappingURL=schema.js.map