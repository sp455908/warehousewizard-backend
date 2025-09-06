"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cargoController = exports.CargoController = void 0;
const notificationService_1 = require("../services/notificationService");
const prisma_1 = require("../config/prisma");
class CargoController {
    async createCargoDispatch(req, res) {
        try {
            const cargoData = req.body;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.create({ data: {
                    bookingId: cargoData.bookingId,
                    itemDescription: cargoData.itemDescription,
                    quantity: cargoData.quantity,
                    weight: cargoData.weight ?? null,
                    dimensions: cargoData.dimensions ?? null,
                    specialHandling: cargoData.specialHandling ?? null,
                    status: cargoData.status || 'submitted',
                } });
            res.status(201).json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create cargo dispatch", error });
        }
    }
    async getCargoDispatches(req, res) {
        try {
            const user = req.user;
            const { bookingId, status } = req.query;
            let filter = {};
            if (bookingId) {
                filter.bookingId = bookingId;
            }
            if (status) {
                filter.status = status;
            }
            else {
                if (user.role === "supervisor") {
                    filter.status = "submitted";
                }
            }
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: filter,
                orderBy: { createdAt: 'desc' },
                include: {
                    approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } },
                    booking: { select: { id: true, customerId: true, warehouseId: true } }
                }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch cargo dispatches", error });
        }
    }
    async getCargoDispatchById(req, res) {
        try {
            const { id } = req.params;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.findUnique({
                where: { id },
                include: {
                    approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } },
                    booking: { select: { id: true, customerId: true, warehouseId: true, startDate: true, endDate: true } }
                }
            });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch cargo dispatch", error });
        }
    }
    async updateCargoDispatch(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.update({
                where: { id },
                data: { ...updateData, updatedAt: new Date() },
                include: {
                    booking: true,
                    approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } }
                }
            });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update cargo dispatch", error });
        }
    }
    async getCargoByBooking(req, res) {
        try {
            const { bookingId } = req.params;
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: { bookingId },
                orderBy: { createdAt: 'desc' },
                include: { approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } } }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch cargo by booking", error });
        }
    }
    async approveCargo(req, res) {
        try {
            const { id } = req.params;
            const supervisorId = req.user?.id || req.user?._id?.toString();
            const cargo = await prisma_1.prisma.cargoDispatchDetail.update({
                where: { id },
                data: { status: "approved", approvedById: supervisorId, updatedAt: new Date() },
                include: { booking: true }
            });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            await notificationService_1.notificationService.sendEmail({
                to: "warehouse@example.com",
                subject: "Cargo Dispatch Approved",
                html: `
          <h2>Cargo Dispatch Approved</h2>
          <p>Cargo dispatch (ID: ${cargo.id}) has been approved.</p>
          <p>Item: ${cargo.itemDescription}</p>
          <p>Quantity: ${cargo.quantity}</p>
        `,
            });
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to approve cargo", error });
        }
    }
    async rejectCargo(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.update({
                where: { id },
                data: {
                    status: "submitted",
                    specialHandling: reason ? `Rejected: ${reason}` : "Rejected",
                    updatedAt: new Date()
                }
            });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to reject cargo", error });
        }
    }
    async processCargo(req, res) {
        try {
            const { id } = req.params;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "processing", updatedAt: new Date() } });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to process cargo", error });
        }
    }
    async completeCargo(req, res) {
        try {
            const { id } = req.params;
            const cargo = await prisma_1.prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "completed", updatedAt: new Date() } });
            if (!cargo) {
                return res.status(404).json({ message: "Cargo dispatch not found" });
            }
            res.json(cargo);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to complete cargo", error });
        }
    }
    async getSubmittedCargo(req, res) {
        try {
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: { status: "submitted" },
                orderBy: { createdAt: 'desc' },
                include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch submitted cargo", error });
        }
    }
    async getApprovedCargo(req, res) {
        try {
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: { status: "approved" },
                orderBy: { createdAt: 'desc' },
                include: {
                    booking: { select: { id: true, customerId: true, warehouseId: true } },
                    approvedBy: { select: { firstName: true, lastName: true, id: true } }
                }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch approved cargo", error });
        }
    }
    async getProcessingCargo(req, res) {
        try {
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: { status: "processing" },
                orderBy: { createdAt: 'desc' },
                include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch processing cargo", error });
        }
    }
    async getCompletedCargo(req, res) {
        try {
            const cargoItems = await prisma_1.prisma.cargoDispatchDetail.findMany({
                where: { status: "completed" },
                orderBy: { createdAt: 'desc' },
                include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
            });
            res.json(cargoItems);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch completed cargo", error });
        }
    }
}
exports.CargoController = CargoController;
exports.cargoController = new CargoController();
//# sourceMappingURL=cargoController.js.map