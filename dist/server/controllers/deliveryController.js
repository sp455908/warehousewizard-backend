"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryController = exports.DeliveryController = void 0;
const notificationService_1 = require("../services/notificationService");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../config/prisma");
class DeliveryController {
    async createDeliveryRequest(req, res) {
        try {
            const deliveryData = {
                ...req.body,
                customerId: req.user?.id,
            };
            const trackingNumber = this.generateTrackingNumber();
            const delivery = await prisma_1.prisma.deliveryRequest.create({
                data: {
                    bookingId: deliveryData.bookingId,
                    customerId: deliveryData.customerId,
                    deliveryAddress: deliveryData.deliveryAddress,
                    preferredDate: new Date(deliveryData.preferredDate),
                    urgency: deliveryData.urgency || 'standard',
                    status: deliveryData.status || 'requested',
                    assignedDriver: deliveryData.assignedDriver || null,
                    trackingNumber,
                }
            });
            await notificationService_1.notificationService.sendEmail({
                to: req.user.email,
                subject: "Delivery Request Created - Warehouse Wizard",
                html: `
          <h2>Delivery Request Created</h2>
          <p>Your delivery request has been created successfully.</p>
          <p>Tracking Number: <strong>${trackingNumber}</strong></p>
          <p>Delivery Address: ${deliveryData.deliveryAddress}</p>
          <p>Preferred Date: ${new Date(deliveryData.preferredDate).toLocaleDateString()}</p>
        `,
            });
            res.status(201).json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create delivery request", error });
        }
    }
    async getDeliveryRequests(req, res) {
        try {
            const user = req.user;
            const { status } = req.query;
            let filter = {};
            if (user.role === "customer") {
                filter.customerId = user.id || user._id?.toString();
            }
            if (status) {
                filter.status = status;
            }
            else {
                if (user.role === "supervisor") {
                    filter.status = "requested";
                }
            }
            const deliveries = await prisma_1.prisma.deliveryRequest.findMany({
                where: filter,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    booking: { select: { id: true, warehouseId: true } }
                }
            });
            res.json(deliveries);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch delivery requests", error });
        }
    }
    async getDeliveryRequestById(req, res) {
        try {
            const { id } = req.params;
            const delivery = await prisma_1.prisma.deliveryRequest.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, mobile: true, id: true } },
                    booking: { select: { id: true, warehouseId: true, customerId: true } }
                }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            const user = req.user;
            if (user.role === "customer" && delivery.customerId !== (user.id || user._id?.toString())) {
                return res.status(403).json({ message: "Access denied" });
            }
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch delivery request", error });
        }
    }
    async updateDeliveryRequest(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const delivery = await prisma_1.prisma.deliveryRequest.update({
                where: { id },
                data: { ...updateData, updatedAt: new Date() },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, id: true } },
                    booking: true
                }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update delivery request", error });
        }
    }
    async scheduleDelivery(req, res) {
        try {
            const { id } = req.params;
            const { scheduledDate, assignedDriver } = req.body;
            const delivery = await prisma_1.prisma.deliveryRequest.update({
                where: { id },
                data: { status: "scheduled", assignedDriver, updatedAt: new Date() },
                include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            await notificationService_1.notificationService.sendEmail({
                to: delivery.customer.email,
                subject: "Delivery Scheduled - Warehouse Wizard",
                html: `
          <h2>Delivery Scheduled</h2>
          <p>Your delivery has been scheduled.</p>
          <p>Tracking Number: ${delivery.trackingNumber}</p>
          <p>Assigned Driver: ${assignedDriver}</p>
          <p>You will receive updates as your delivery progresses.</p>
        `,
            });
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to schedule delivery", error });
        }
    }
    async assignDriver(req, res) {
        try {
            const { id } = req.params;
            const { assignedDriver } = req.body;
            const delivery = await prisma_1.prisma.deliveryRequest.update({ where: { id }, data: { assignedDriver, updatedAt: new Date() } });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to assign driver", error });
        }
    }
    async dispatchDelivery(req, res) {
        try {
            const { id } = req.params;
            const delivery = await prisma_1.prisma.deliveryRequest.update({
                where: { id },
                data: { status: "in_transit", updatedAt: new Date() },
                include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            await notificationService_1.notificationService.sendDeliveryNotification(delivery.customer.email, delivery.trackingNumber);
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to dispatch delivery", error });
        }
    }
    async completeDelivery(req, res) {
        try {
            const { id } = req.params;
            const { deliveryNotes } = req.body;
            const delivery = await prisma_1.prisma.deliveryRequest.update({
                where: { id },
                data: { status: "delivered", updatedAt: new Date() },
                include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            await notificationService_1.notificationService.sendEmail({
                to: delivery.customer.email,
                subject: "Delivery Completed - Warehouse Wizard",
                html: `
          <h2>Delivery Completed</h2>
          <p>Your delivery has been completed successfully.</p>
          <p>Tracking Number: ${delivery.trackingNumber}</p>
          <p>Delivery Address: ${delivery.deliveryAddress}</p>
          ${deliveryNotes ? `<p>Notes: ${deliveryNotes}</p>` : ''}
          <p>Thank you for using Warehouse Wizard!</p>
        `,
            });
            res.json(delivery);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to complete delivery", error });
        }
    }
    async trackDelivery(req, res) {
        try {
            const { id } = req.params;
            const delivery = await prisma_1.prisma.deliveryRequest.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, id: true } },
                    booking: { select: { id: true, warehouseId: true } }
                }
            });
            if (!delivery) {
                return res.status(404).json({ message: "Delivery request not found" });
            }
            const trackingInfo = {
                trackingNumber: delivery.trackingNumber,
                status: delivery.status,
                deliveryAddress: delivery.deliveryAddress,
                preferredDate: delivery.preferredDate,
                assignedDriver: delivery.assignedDriver,
                urgency: delivery.urgency,
                createdAt: delivery.createdAt,
                updatedAt: delivery.updatedAt,
            };
            res.json(trackingInfo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to track delivery", error });
        }
    }
    async getRequestedDeliveries(req, res) {
        try {
            const deliveries = await prisma_1.prisma.deliveryRequest.findMany({
                where: { status: "requested" },
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    booking: { select: { id: true, warehouseId: true } }
                }
            });
            res.json(deliveries);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch requested deliveries", error });
        }
    }
    async getScheduledDeliveries(req, res) {
        try {
            const deliveries = await prisma_1.prisma.deliveryRequest.findMany({
                where: { status: "scheduled" },
                orderBy: { preferredDate: 'asc' },
                include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
            });
            res.json(deliveries);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch scheduled deliveries", error });
        }
    }
    async getInTransitDeliveries(req, res) {
        try {
            const deliveries = await prisma_1.prisma.deliveryRequest.findMany({
                where: { status: "in_transit" },
                orderBy: { updatedAt: 'desc' },
                include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
            });
            res.json(deliveries);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch in-transit deliveries", error });
        }
    }
    async getDeliveredDeliveries(req, res) {
        try {
            const user = req.user;
            let where = { status: "delivered" };
            if (user.role === "customer")
                where.customerId = user.id || user._id?.toString();
            const deliveries = await prisma_1.prisma.deliveryRequest.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
            });
            res.json(deliveries);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch delivered deliveries", error });
        }
    }
    generateTrackingNumber() {
        const prefix = "WW";
        const timestamp = Date.now().toString().slice(-8);
        const random = crypto_1.default.randomBytes(2).toString("hex").toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }
}
exports.DeliveryController = DeliveryController;
exports.deliveryController = new DeliveryController();
//# sourceMappingURL=deliveryController.js.map