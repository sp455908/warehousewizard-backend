import mongoose, { Document } from "mongoose";
import { z } from "zod";
export declare const userRoles: readonly ["customer", "purchase_support", "sales_support", "supervisor", "warehouse", "accounts", "admin"];
export type UserRole = typeof userRoles[number];
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
export declare const UserModel: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export interface IOtpVerification extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: "email" | "mobile";
    code: string;
    expiresAt: Date;
    isUsed: boolean;
    createdAt: Date;
}
export declare const OtpVerificationModel: mongoose.Model<IOtpVerification, {}, {}, {}, mongoose.Document<unknown, {}, IOtpVerification, {}> & IOtpVerification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
}
export declare const WarehouseModel: mongoose.Model<IWarehouse, {}, {}, {}, mongoose.Document<unknown, {}, IWarehouse, {}> & IWarehouse & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare const QuoteModel: mongoose.Model<IQuote, {}, {}, {}, mongoose.Document<unknown, {}, IQuote, {}> & IQuote & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare const BookingModel: mongoose.Model<IBooking, {}, {}, {}, mongoose.Document<unknown, {}, IBooking, {}> & IBooking & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare const CargoDispatchDetailModel: mongoose.Model<ICargoDispatchDetail, {}, {}, {}, mongoose.Document<unknown, {}, ICargoDispatchDetail, {}> & ICargoDispatchDetail & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare const DeliveryRequestModel: mongoose.Model<IDeliveryRequest, {}, {}, {}, mongoose.Document<unknown, {}, IDeliveryRequest, {}> & IDeliveryRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare const InvoiceModel: mongoose.Model<IInvoice, {}, {}, {}, mongoose.Document<unknown, {}, IInvoice, {}> & IInvoice & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const insertUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    mobile: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
    role: z.ZodDefault<z.ZodEnum<{
        warehouse: "warehouse";
        customer: "customer";
        purchase_support: "purchase_support";
        sales_support: "sales_support";
        supervisor: "supervisor";
        accounts: "accounts";
        admin: "admin";
    }>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    isEmailVerified: z.ZodDefault<z.ZodBoolean>;
    isMobileVerified: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const insertOtpSchema: z.ZodObject<{
    userId: z.ZodString;
    type: z.ZodEnum<{
        email: "email";
        mobile: "mobile";
    }>;
    code: z.ZodString;
    expiresAt: z.ZodDate;
    isUsed: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const insertWarehouseSchema: z.ZodObject<{
    name: z.ZodString;
    location: z.ZodString;
    city: z.ZodString;
    state: z.ZodString;
    storageType: z.ZodEnum<{
        cold_storage: "cold_storage";
        dry_storage: "dry_storage";
        hazmat: "hazmat";
        climate_controlled: "climate_controlled";
    }>;
    totalSpace: z.ZodNumber;
    availableSpace: z.ZodNumber;
    pricePerSqFt: z.ZodNumber;
    features: z.ZodOptional<z.ZodAny>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const insertQuoteSchema: z.ZodObject<{
    customerId: z.ZodString;
    storageType: z.ZodString;
    requiredSpace: z.ZodNumber;
    preferredLocation: z.ZodString;
    duration: z.ZodString;
    specialRequirements: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        processing: "processing";
        quoted: "quoted";
        approved: "approved";
        rejected: "rejected";
    }>>;
    assignedTo: z.ZodOptional<z.ZodString>;
    finalPrice: z.ZodOptional<z.ZodNumber>;
    warehouseId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const insertBookingSchema: z.ZodObject<{
    quoteId: z.ZodString;
    customerId: z.ZodString;
    warehouseId: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        confirmed: "confirmed";
        active: "active";
        completed: "completed";
        cancelled: "cancelled";
    }>>;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    totalAmount: z.ZodNumber;
    approvedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const insertCargoDispatchSchema: z.ZodObject<{
    bookingId: z.ZodString;
    itemDescription: z.ZodString;
    quantity: z.ZodNumber;
    weight: z.ZodOptional<z.ZodNumber>;
    dimensions: z.ZodOptional<z.ZodString>;
    specialHandling: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        processing: "processing";
        approved: "approved";
        completed: "completed";
        submitted: "submitted";
    }>>;
    approvedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const insertDeliveryRequestSchema: z.ZodObject<{
    bookingId: z.ZodString;
    customerId: z.ZodString;
    deliveryAddress: z.ZodString;
    preferredDate: z.ZodDate;
    urgency: z.ZodDefault<z.ZodEnum<{
        standard: "standard";
        express: "express";
        urgent: "urgent";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        requested: "requested";
        scheduled: "scheduled";
        in_transit: "in_transit";
        delivered: "delivered";
    }>>;
    assignedDriver: z.ZodOptional<z.ZodString>;
    trackingNumber: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const insertInvoiceSchema: z.ZodObject<{
    bookingId: z.ZodString;
    customerId: z.ZodString;
    invoiceNumber: z.ZodString;
    amount: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<{
        cancelled: "cancelled";
        draft: "draft";
        sent: "sent";
        paid: "paid";
        overdue: "overdue";
    }>>;
    dueDate: z.ZodDate;
    paidAt: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
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
//# sourceMappingURL=schema.d.ts.map