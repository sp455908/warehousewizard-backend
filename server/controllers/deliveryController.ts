import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import crypto from "crypto";
import { prisma } from "../config/prisma";

export class DeliveryController {
  async createDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveryData = {
        ...req.body,
        customerId: req.user?.id as string,
      } as any;

      // Generate tracking number
      const trackingNumber = this.generateTrackingNumber();
      
      const delivery = await prisma.deliveryRequest.create({
        data: {
          bookingId: (deliveryData as any).bookingId,
          customerId: deliveryData.customerId,
          deliveryAddress: deliveryData.deliveryAddress,
          preferredDate: new Date(deliveryData.preferredDate as any),
          urgency: (deliveryData as any).urgency || 'standard',
          status: (deliveryData as any).status || 'requested',
          assignedDriver: (deliveryData as any).assignedDriver || null,
          trackingNumber,
        }
      });

      // Send confirmation notification
      await notificationService.sendEmail({
        to: (req.user as any).email,
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery request", error });
    }
  }

  async getDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { status } = req.query;
      
      let filter: any = {};
      
      if (user.role === "customer") {
        filter.customerId = user.id || user._id?.toString();
      }
      
      // For warehouse users, default to scheduled requests (temporarily show all due to missing user→warehouse mapping)
      if (user.role === "warehouse") {
        filter.status = (status as string) || "scheduled";
      }
      
      if (status) {
        filter.status = status as string;
      } else {
        // Default filter based on role
        if (user.role === "supervisor") {
          filter.status = "requested";
        }
      }
      const deliveries = await prisma.deliveryRequest.findMany({
        where: {
          ...filter
          // NOTE: Intentionally not scoping by booking.warehouseId for warehouse users
          // because User.id does not map to Warehouse.id in current schema. Add mapping later.
        },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          booking: { select: { id: true, warehouseId: true } }
        }
      });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery requests", error });
    }
  }

  async getDeliveryRequestById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const delivery = await prisma.deliveryRequest.findUnique({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, mobile: true, id: true } },
          booking: { select: { id: true, warehouseId: true, customerId: true } }
        }
      });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Check permissions
      const user = req.user! as any;
      if (user.role === "customer" && (delivery as any).customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery request", error });
    }
  }

  async updateDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const delivery = await prisma.deliveryRequest.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() as any },
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery request", error });
    }
  }

  async scheduleDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledDate, assignedDriver } = req.body as any;
      const delivery = await prisma.deliveryRequest.update({
        where: { id },
        data: { status: "scheduled", assignedDriver, updatedAt: new Date() as any },
        include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
      });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send notification
      await notificationService.sendEmail({
        to: (delivery as any).customer.email,
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to schedule delivery", error });
    }
  }

  async assignDriver(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedDriver } = req.body as any;
      const delivery = await prisma.deliveryRequest.update({ where: { id }, data: { assignedDriver, updatedAt: new Date() as any } });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign driver", error });
    }
  }

  async dispatchDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const delivery = await prisma.deliveryRequest.update({
        where: { id },
        data: { status: "in_transit", updatedAt: new Date() as any },
        include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
      });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send notification
      await notificationService.sendDeliveryNotification(
        (delivery as any).customer.email,
        (delivery as any).trackingNumber!
      );

      res.json(delivery);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to dispatch delivery", error });
    }
  }

  async completeDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { deliveryNotes } = req.body as any;
      const delivery = await prisma.deliveryRequest.update({
        where: { id },
        data: { status: "delivered", updatedAt: new Date() as any },
        include: { customer: { select: { firstName: true, lastName: true, email: true, id: true } } }
      });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Send completion notification
      await notificationService.sendEmail({
        to: (delivery as any).customer.email,
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to complete delivery", error });
    }
  }

  async trackDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const delivery = await prisma.deliveryRequest.findUnique({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, id: true } },
          booking: { select: { id: true, warehouseId: true } }
        }
      });

      if (!delivery) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Return tracking information
      const trackingInfo = {
        trackingNumber: (delivery as any).trackingNumber,
        status: (delivery as any).status,
        deliveryAddress: (delivery as any).deliveryAddress,
        preferredDate: (delivery as any).preferredDate,
        assignedDriver: (delivery as any).assignedDriver,
        urgency: (delivery as any).urgency,
        createdAt: (delivery as any).createdAt,
        updatedAt: (delivery as any).updatedAt,
      };

      res.json(trackingInfo);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to track delivery", error });
    }
  }

  // Status-specific getters
  async getRequestedDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await prisma.deliveryRequest.findMany({
        where: { status: "requested" },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
          booking: { select: { id: true, warehouseId: true } }
        }
      });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch requested deliveries", error });
    }
  }

  async getScheduledDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await prisma.deliveryRequest.findMany({
        where: { status: "scheduled" },
        orderBy: { preferredDate: 'asc' },
        include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
      });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch scheduled deliveries", error });
    }
  }

  async getInTransitDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveries = await prisma.deliveryRequest.findMany({
        where: { status: "in_transit" },
        orderBy: { updatedAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
      });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch in-transit deliveries", error });
    }
  }

  async getDeliveredDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let where: any = { status: "delivered" };
      if (user.role === "customer") where.customerId = user.id || user._id?.toString();
      const deliveries = await prisma.deliveryRequest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } }
      });

      res.json(deliveries);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivered deliveries", error });
    }
  }

  // Supervisor: Approve/Reject delivery requests (A26-A27)
  async approveDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes, deliveryAdvice } = req.body;
      
      // Only supervisor can approve delivery requests
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryRequest = await prisma.deliveryRequest.findUnique({
        where: { id },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { 
            include: { 
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          }
        }
      });

      if (!deliveryRequest) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Update delivery request status
      const updatedRequest = await prisma.deliveryRequest.update({
        where: { id },
        data: { 
          status: "scheduled",
          assignedDriver: (req.user! as any).id // Assign supervisor as approver
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { 
            include: { 
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          }
        }
      });

      // Create delivery advice if provided
      if (deliveryAdvice) {
        await prisma.deliveryAdvice.create({
          data: {
            bookingId: deliveryRequest.bookingId,
            customerId: deliveryRequest.customerId,
            deliveryAddress: deliveryRequest.deliveryAddress,
            preferredDate: deliveryRequest.preferredDate,
            urgency: deliveryRequest.urgency,
            instructions: deliveryAdvice,
            status: "created"
          }
        });
      }

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryRequest.customer?.email || "",
        subject: "Delivery Request Approved - Warehouse Wizard",
        html: `
          <h2>Delivery Request Approved</h2>
          <p>Your delivery request has been approved and is being processed.</p>
          <p>Tracking Number: <strong>${deliveryRequest.trackingNumber}</strong></p>
          <p>Delivery Address: ${deliveryRequest.deliveryAddress}</p>
          <p>Preferred Date: ${new Date(deliveryRequest.preferredDate).toLocaleDateString()}</p>
          <p>Status: Approved and ready for dispatch</p>
        `
      });

      // Send notification to warehouse
      await notificationService.sendEmail({
        to: "warehouse@warehousewizard.com", // This should be dynamic
        subject: "Delivery Request Approved - Action Required",
        html: `
          <h2>Delivery Request Approved</h2>
          <p>Customer: ${deliveryRequest.customer?.firstName} ${deliveryRequest.customer?.lastName}</p>
          <p>Tracking Number: ${deliveryRequest.trackingNumber}</p>
          <p>Warehouse: ${deliveryRequest.booking?.warehouse?.name}</p>
          <p>Please prepare for delivery dispatch.</p>
        `
      });

      res.json({ message: "Delivery request approved successfully", deliveryRequest: updatedRequest });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve delivery request", error });
    }
  }

  async rejectDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only supervisor can reject delivery requests
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryRequest = await prisma.deliveryRequest.findUnique({
        where: { id },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });

      if (!deliveryRequest) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Update delivery request status
      const updatedRequest = await prisma.deliveryRequest.update({
        where: { id },
        data: { 
          status: "requested"
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryRequest.customer?.email || "",
        subject: "Delivery Request Update - Warehouse Wizard",
        html: `
          <h2>Delivery Request Update</h2>
          <p>Your delivery request has been reviewed and unfortunately cannot be processed at this time.</p>
          <p>Tracking Number: ${deliveryRequest.trackingNumber}</p>
          <p>Reason: ${reason || "No specific reason provided"}</p>
          <p>Please contact our support team for more information or to submit a new request.</p>
        `
      });

      res.json({ message: "Delivery request rejected", deliveryRequest: updatedRequest });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject delivery request", error });
    }
  }

  private generateTrackingNumber(): string {
    const prefix = "WW";
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}

export const deliveryController = new DeliveryController();