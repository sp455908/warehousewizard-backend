import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

// User role enum
export const userRoles = [
  "customer",
  "purchase_support", 
  "sales_support",
  "supervisor",
  "warehouse",
  "accounts",
  "admin"
] as const;

export type UserRole = typeof userRoles[number];

// User interface and schema
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile?: string;
  company?: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  mobile: { type: String },
  company: { type: String },
  role: { type: String, enum: userRoles, default: "customer" },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  isMobileVerified: { type: Boolean, default: false },
}, { timestamps: true });

export const UserModel = mongoose.model<IUser>("User", userSchema);

// OTP Verification interface and schema
export interface IOtpVerification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "email" | "mobile";
  code: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

const otpVerificationSchema = new Schema<IOtpVerification>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["email", "mobile"], required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
}, { timestamps: true });

export const OtpVerificationModel = mongoose.model<IOtpVerification>("OtpVerification", otpVerificationSchema);

// Warehouse interface and schema
export interface IWarehouse extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  location: string;
  city: string;
  state: string;
  storageType: "domestic_dry" | "domestic_reefer" | "bonded_dry" | "bonded_reefer" | "cfs_import" | "cfs_export_dry" | "cfs_export_reefer";
  totalSpace: number;
  availableSpace: number;
  pricePerSqFt: number;
  features?: any;
  isActive: boolean;
  imageUrl?: string;
  ownerId?: string; // Warehouse owner/manager
}

const warehouseSchema = new Schema<IWarehouse>({
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
  features: { type: Schema.Types.Mixed },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true },
  ownerId: { type: String }, // Warehouse owner/manager
}, { timestamps: true });

export const WarehouseModel = mongoose.model<IWarehouse>("Warehouse", warehouseSchema);

// Quote interface and schema
export interface IQuote extends Document {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  storageType: string;
  requiredSpace: number;
  preferredLocation: string;
  duration: string;
  specialRequirements?: string;
  status: "pending" | "processing" | "quoted" | "approved" | "rejected";
  assignedTo?: mongoose.Types.ObjectId;
  finalPrice?: number;
  warehouseId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>({
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
  assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  finalPrice: { type: Number },
  warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
}, { timestamps: true });

export const QuoteModel = mongoose.model<IQuote>("Quote", quoteSchema);

// Booking interface and schema
export interface IBooking extends Document {
  _id: mongoose.Types.ObjectId;
  quoteId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>({
  quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "active", "completed", "cancelled"], 
    default: "pending" 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const BookingModel = mongoose.model<IBooking>("Booking", bookingSchema);

// Cargo Dispatch Detail interface and schema
export interface ICargoDispatchDetail extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  itemDescription: string;
  quantity: number;
  weight?: number;
  dimensions?: string;
  specialHandling?: string;
  status: "submitted" | "approved" | "processing" | "completed";
  approvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cargoDispatchDetailSchema = new Schema<ICargoDispatchDetail>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
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
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const CargoDispatchDetailModel = mongoose.model<ICargoDispatchDetail>("CargoDispatchDetail", cargoDispatchDetailSchema);

// Delivery Request interface and schema
export interface IDeliveryRequest extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  deliveryAddress: string;
  preferredDate: Date;
  urgency: "standard" | "express" | "urgent";
  status: "requested" | "scheduled" | "in_transit" | "delivered";
  assignedDriver?: string;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryRequestSchema = new Schema<IDeliveryRequest>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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

export const DeliveryRequestModel = mongoose.model<IDeliveryRequest>("DeliveryRequest", deliveryRequestSchema);

// Invoice interface and schema
export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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

export const InvoiceModel = mongoose.model<IInvoice>("Invoice", invoiceSchema);

// Zod validation schemas
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobile: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(userRoles).default("customer"),
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  isMobileVerified: z.boolean().default(false),
});

export const insertOtpSchema = z.object({
  userId: z.string(),
  type: z.enum(["email", "mobile"]),
  code: z.string(),
  expiresAt: z.date(),
  isUsed: z.boolean().default(false),
});

export const insertWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  storageType: z.enum(["cold_storage", "dry_storage", "hazmat", "climate_controlled"]),
  totalSpace: z.number().positive(),
  availableSpace: z.number().positive(),
  pricePerSqFt: z.number().positive(),
  features: z.any().optional(),
  isActive: z.boolean().default(true),
});

export const insertQuoteSchema = z.object({
  customerId: z.string(),
  storageType: z.string().min(1),
  requiredSpace: z.number().positive(),
  preferredLocation: z.string().min(1),
  duration: z.string().min(1),
  specialRequirements: z.string().optional(),
  status: z.enum(["pending", "processing", "quoted", "approved", "rejected"]).default("pending"),
  assignedTo: z.string().optional(),
  finalPrice: z.number().optional(),
  warehouseId: z.string().optional(),
});

export const insertBookingSchema = z.object({
  quoteId: z.string(),
  customerId: z.string(),
  warehouseId: z.string(),
  status: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).default("pending"),
  startDate: z.date(),
  endDate: z.date(),
  totalAmount: z.number().positive(),
  approvedBy: z.string().optional(),
});

export const insertCargoDispatchSchema = z.object({
  bookingId: z.string(),
  itemDescription: z.string().min(1),
  quantity: z.number().positive(),
  weight: z.number().optional(),
  dimensions: z.string().optional(),
  specialHandling: z.string().optional(),
  status: z.enum(["submitted", "approved", "processing", "completed"]).default("submitted"),
  approvedBy: z.string().optional(),
});

export const insertDeliveryRequestSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  deliveryAddress: z.string().min(1),
  preferredDate: z.date(),
  urgency: z.enum(["standard", "express", "urgent"]).default("standard"),
  status: z.enum(["requested", "scheduled", "in_transit", "delivered"]).default("requested"),
  assignedDriver: z.string().optional(),
  trackingNumber: z.string().optional(),
});

export const insertInvoiceSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  invoiceNumber: z.string().min(1),
  amount: z.number().positive(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  dueDate: z.date(),
  paidAt: z.date().optional(),
});

// Types
export type User = IUser;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type OtpVerification = IOtpVerification;
export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type Warehouse = IWarehouse;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Quote = IQuote;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Booking = IBooking;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type CargoDispatchDetail = ICargoDispatchDetail;
export type InsertCargoDispatchDetail = z.infer<typeof insertCargoDispatchSchema>;
export type DeliveryRequest = IDeliveryRequest;
export type InsertDeliveryRequest = z.infer<typeof insertDeliveryRequestSchema>;
export type Invoice = IInvoice;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;