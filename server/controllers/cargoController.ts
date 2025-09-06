import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class CargoController {
  async createCargoDispatch(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoData = req.body;
      const cargo = await prisma.cargoDispatchDetail.create({ data: {
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to create cargo dispatch", error });
    }
  }

  async getCargoDispatches(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { bookingId, status } = req.query;
      
      let filter: any = {};
      
      if (bookingId) {
        filter.bookingId = bookingId as string;
      }
      
      if (status) {
        filter.status = status as string;
      } else {
        // Default filter based on role
        if (user.role === "supervisor") {
          filter.status = "submitted";
        }
      }

      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        include: {
          approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } },
          booking: { select: { id: true, customerId: true, warehouseId: true } }
        }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo dispatches", error });
    }
  }

  async getCargoDispatchById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const cargo = await prisma.cargoDispatchDetail.findUnique({
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo dispatch", error });
    }
  }

  async updateCargoDispatch(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() as any },
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to update cargo dispatch", error });
    }
  }

  async getCargoByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        include: { approvedBy: { select: { firstName: true, lastName: true, email: true, id: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch cargo by booking", error });
    }
  }

  async approveCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: { status: "approved", approvedById: supervisorId, updatedAt: new Date() as any },
        include: { booking: true }
      });

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      // Send notification
      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get warehouse email from booking
        subject: "Cargo Dispatch Approved",
        html: `
          <h2>Cargo Dispatch Approved</h2>
          <p>Cargo dispatch (ID: ${(cargo as any).id}) has been approved.</p>
          <p>Item: ${(cargo as any).itemDescription}</p>
          <p>Quantity: ${(cargo as any).quantity}</p>
        `,
      });

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve cargo", error });
    }
  }

  async rejectCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const cargo = await prisma.cargoDispatchDetail.update({
        where: { id },
        data: {
          status: "submitted",
          specialHandling: reason ? `Rejected: ${reason}` : "Rejected",
          updatedAt: new Date() as any
        }
      });

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject cargo", error });
    }
  }

  async processCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const cargo = await prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "processing", updatedAt: new Date() as any } });

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to process cargo", error });
    }
  }

  async completeCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const cargo = await prisma.cargoDispatchDetail.update({ where: { id }, data: { status: "completed", updatedAt: new Date() as any } });

      if (!cargo) {
        return res.status(404).json({ message: "Cargo dispatch not found" });
      }

      res.json(cargo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to complete cargo", error });
    }
  }

  // Status-specific getters
  async getSubmittedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "submitted" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch submitted cargo", error });
    }
  }

  async getApprovedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: { select: { id: true, customerId: true, warehouseId: true } },
          approvedBy: { select: { firstName: true, lastName: true, id: true } }
        }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch approved cargo", error });
    }
  }

  async getProcessingCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "processing" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch processing cargo", error });
    }
  }

  async getCompletedCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const cargoItems = await prisma.cargoDispatchDetail.findMany({
        where: { status: "completed" },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { id: true, customerId: true, warehouseId: true } } }
      });

      res.json(cargoItems);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch completed cargo", error });
    }
  }
}

export const cargoController = new CargoController();