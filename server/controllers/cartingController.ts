import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class CartingController {
  async createCartingDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const cartingData = req.body;
      
      // Only warehouse can create carting details
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Validate booking and resolve warehouseId
      if (!cartingData.bookingId) {
        return res.status(400).json({ message: "bookingId is required" });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: cartingData.bookingId },
        select: { id: true, warehouseId: true }
      });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const resolvedWarehouseId = booking.warehouseId || (req.user as any)?.id;
      if (!resolvedWarehouseId) {
        return res.status(400).json({ message: "warehouseId could not be resolved" });
      }

      const cartingDetail = await prisma.cartingDetail.create({
        data: {
          booking: { connect: { id: booking.id } },
          warehouse: { connect: { id: resolvedWarehouseId } },
          itemDescription: cartingData.itemDescription,
          quantity: cartingData.quantity,
          weight: cartingData.weight || null,
          dimensions: cartingData.dimensions || null,
          specialHandling: cartingData.specialHandling || null,
          status: "submitted",
        },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } }
            }
          },
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `Carting Details Submitted - Booking ${cartingData.bookingId}`,
        html: `
          <h2>Carting Details Submitted</h2>
          <p>Warehouse ${(cartingDetail.warehouse as any).name} has submitted carting details.</p>
          <p>Booking ID: ${cartingData.bookingId}</p>
          <p>Item: ${cartingData.itemDescription}</p>
          <p>Quantity: ${cartingData.quantity}</p>
          <p>Weight: ${cartingData.weight || 'N/A'}</p>
          <p>Dimensions: ${cartingData.dimensions || 'N/A'}</p>
          <p>Special Handling: ${cartingData.specialHandling || 'None'}</p>
        `,
      });

      res.status(201).json(cartingDetail);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create carting detail", error });
    }
  }

  async getCartingDetails(req: AuthenticatedRequest, res: Response) {
    try {
      // Return all carting details for authorized roles
      // Note: We cannot scope by warehouse here because User.id is not Warehouse.id.
      // Proper scoping requires a user-to-warehouse mapping, which can be added later.
      const cartingDetails = await prisma.cartingDetail.findMany({
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          },
          warehouse: { select: { name: true, location: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(cartingDetails);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch carting details", error });
    }
  }

  async getCartingDetailById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const cartingDetail = await prisma.cartingDetail.findUnique({
        where: { id },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!cartingDetail) {
        return res.status(404).json({ message: "Carting detail not found" });
      }

      res.json(cartingDetail);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch carting detail", error });
    }
  }

  async updateCartingDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const cartingDetail = await prisma.cartingDetail.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } }
            }
          },
          warehouse: { select: { name: true, location: true } }
        }
      });

      res.json(cartingDetail);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update carting detail", error });
    }
  }

  async confirmCartingDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      // Only supervisor can confirm carting details
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const cartingDetail = await prisma.cartingDetail.update({
        where: { id },
        data: { 
          status: "confirmed",
          confirmedAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } }
            }
          },
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to customer and warehouse
      await notificationService.sendEmail({
        to: (cartingDetail.booking as any).customer.email,
        subject: `Carting Details Confirmed - Booking ${(cartingDetail.booking as any).id}`,
        html: `
          <h2>Carting Details Confirmed</h2>
          <p>Your carting details have been confirmed by the supervisor.</p>
          <p>Booking ID: ${(cartingDetail.booking as any).id}</p>
          <p>Item: ${cartingDetail.itemDescription}</p>
          <p>Quantity: ${cartingDetail.quantity}</p>
          <p>Warehouse: ${(cartingDetail.warehouse as any).name}</p>
        `,
      });

      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Carting Details Confirmed - Booking ${(cartingDetail.booking as any).id}`,
        html: `
          <h2>Carting Details Confirmed</h2>
          <p>Carting details have been confirmed by the supervisor.</p>
          <p>Booking ID: ${(cartingDetail.booking as any).id}</p>
          <p>Item: ${cartingDetail.itemDescription}</p>
          <p>Quantity: ${cartingDetail.quantity}</p>
        `,
      });

      res.json(cartingDetail);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to confirm carting detail", error });
    }
  }

  async rejectCartingDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only supervisor can reject carting details
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const cartingDetail = await prisma.cartingDetail.update({
        where: { id },
        data: { 
          status: "rejected",
          specialHandling: reason ? `Rejected: ${reason}` : "Rejected",
          updatedAt: new Date()
        },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } }
            }
          },
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to warehouse
      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Carting Details Rejected - Booking ${(cartingDetail.booking as any).id}`,
        html: `
          <h2>Carting Details Rejected</h2>
          <p>Your carting details have been rejected by the supervisor.</p>
          <p>Booking ID: ${(cartingDetail.booking as any).id}</p>
          <p>Reason: ${reason || 'No reason provided'}</p>
          <p>Please review and resubmit the carting details.</p>
        `,
      });

      res.json(cartingDetail);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject carting detail", error });
    }
  }

  async getCartingDetailsByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const cartingDetails = await prisma.cartingDetail.findMany({
        where: { bookingId },
        include: {
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(cartingDetails);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch carting details by booking", error });
    }
  }
}

export const cartingController = new CartingController();