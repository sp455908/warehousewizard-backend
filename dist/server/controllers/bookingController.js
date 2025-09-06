"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingController = exports.BookingController = void 0;
const notificationService_1 = require("../services/notificationService");
const warehouseService_1 = require("../services/warehouseService");
const prisma_1 = require("../config/prisma");
class BookingController {
    async createBooking(req, res) {
        try {
            const authUserId = req.user?.id;
            const bookingData = {
                ...req.body,
                customerId: authUserId,
            };
            const isAvailable = await warehouseService_1.warehouseService.checkAvailability(bookingData.warehouseId, req.body.requiredSpace || 0);
            if (!isAvailable) {
                return res.status(400).json({ message: "Insufficient warehouse space available" });
            }
            const booking = await prisma_1.prisma.booking.create({
                data: {
                    quoteId: bookingData.quoteId,
                    customerId: bookingData.customerId,
                    warehouseId: bookingData.warehouseId,
                    status: bookingData.status || 'pending',
                    startDate: new Date(bookingData.startDate),
                    endDate: new Date(bookingData.endDate),
                    totalAmount: bookingData.totalAmount,
                }
            });
            await notificationService_1.notificationService.sendBookingConfirmationNotification(req.user.email, booking.id);
            res.status(201).json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create booking", error });
        }
    }
    async getBookings(req, res) {
        try {
            const user = req.user;
            let where = {};
            if (user.role === "customer") {
                where.customerId = user.id || user._id?.toString();
            }
            else if (user.role === "supervisor") {
                where.status = "pending";
            }
            const bookings = await prisma_1.prisma.booking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
                    quote: true,
                    approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
                }
            });
            res.json(bookings);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch bookings", error });
        }
    }
    async getBookingById(req, res) {
        try {
            const { id } = req.params;
            const booking = await prisma_1.prisma.booking.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, features: true, id: true } },
                    quote: true,
                    approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
                }
            });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            const user = req.user;
            if (user.role === "customer" && booking.customerId !== (user.id || user._id?.toString())) {
                return res.status(403).json({ message: "Access denied" });
            }
            res.json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch booking", error });
        }
    }
    async updateBooking(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const booking = await prisma_1.prisma.booking.update({
                where: { id },
                data: { ...updateData, updatedAt: new Date() },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
                }
            });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            res.json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update booking", error });
        }
    }
    async confirmBooking(req, res) {
        try {
            const { id } = req.params;
            const supervisorId = req.user?.id || req.user?._id?.toString();
            const booking = await prisma_1.prisma.booking.update({
                where: { id },
                data: {
                    status: "confirmed",
                    approvedById: supervisorId,
                    updatedAt: new Date()
                },
                include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
            });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            await notificationService_1.notificationService.sendBookingConfirmationNotification(booking.customer.email, booking.id);
            res.json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to confirm booking", error });
        }
    }
    async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const booking = await prisma_1.prisma.booking.update({
                where: { id },
                data: { status: "cancelled", updatedAt: new Date() },
                include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
            });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            await notificationService_1.notificationService.sendEmail({
                to: booking.customer.email,
                subject: "Booking Cancelled - Warehouse Wizard",
                html: `
          <h2>Booking Cancelled</h2>
          <p>Your booking (ID: ${booking.id}) has been cancelled.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
        `,
            });
            res.json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to cancel booking", error });
        }
    }
    async approveBooking(req, res) {
        try {
            const { id } = req.params;
            const customerId = req.user?.id || req.user?._id?.toString();
            const booking = await prisma_1.prisma.booking.findFirst({ where: { id, customerId } });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            if (booking.status !== "pending") {
                return res.status(400).json({ message: "Booking cannot be approved in current status" });
            }
            const updatedBooking = await prisma_1.prisma.booking.update({ where: { id }, data: { status: "pending", updatedAt: new Date() } });
            res.json(updatedBooking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to approve booking", error });
        }
    }
    async rejectBooking(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const customerId = req.user?.id || req.user?._id?.toString();
            const booking = await prisma_1.prisma.booking.update({ where: { id }, data: { status: "cancelled", updatedAt: new Date() } });
            if (!booking) {
                return res.status(404).json({ message: "Booking not found" });
            }
            res.json(booking);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to reject booking", error });
        }
    }
    async getPendingBookings(req, res) {
        try {
            const bookings = await prisma_1.prisma.booking.findMany({
                where: { status: "pending" },
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
                }
            });
            res.json(bookings);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch pending bookings", error });
        }
    }
    async getConfirmedBookings(req, res) {
        try {
            const user = req.user;
            let where = { status: "confirmed" };
            if (user.role === "customer")
                where.customerId = user.id || user._id?.toString();
            const bookings = await prisma_1.prisma.booking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
                    approvedBy: { select: { firstName: true, lastName: true, id: true } }
                }
            });
            res.json(bookings);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch confirmed bookings", error });
        }
    }
    async getActiveBookings(req, res) {
        try {
            const user = req.user;
            let where = { status: "active" };
            if (user.role === "customer")
                where.customerId = user.id || user._id?.toString();
            const bookings = await prisma_1.prisma.booking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
                }
            });
            res.json(bookings);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch active bookings", error });
        }
    }
    async getCompletedBookings(req, res) {
        try {
            const user = req.user;
            let where = { status: "completed" };
            if (user.role === "customer")
                where.customerId = user.id || user._id?.toString();
            const bookings = await prisma_1.prisma.booking.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } }
                }
            });
            res.json(bookings);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch completed bookings", error });
        }
    }
}
exports.BookingController = BookingController;
exports.bookingController = new BookingController();
//# sourceMappingURL=bookingController.js.map