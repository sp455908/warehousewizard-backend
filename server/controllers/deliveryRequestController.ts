import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { notificationService } from "../services/notificationService";

export class DeliveryRequestController {
  // Customer creates delivery request (C25)
  async createDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId, deliveryAddress, preferredDate, urgency } = req.body;
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only customers can create delivery requests
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Verify booking exists and belongs to customer
      const booking = await prisma.booking.findFirst({
        where: { 
          id: bookingId, 
          customerId,
          status: "confirmed" // Only confirmed bookings can have delivery requests
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found or not confirmed" });
      }

      // Check if delivery request already exists for this booking
      const existingRequest = await prisma.deliveryRequest.findFirst({
        where: { bookingId }
      });

      if (existingRequest) {
        return res.status(409).json({ message: "Delivery request already exists for this booking" });
      }

      const deliveryRequest = await prisma.deliveryRequest.create({
        data: {
          bookingId,
          customerId,
          deliveryAddress,
          preferredDate: new Date(preferredDate),
          urgency: urgency || "standard",
          status: "requested"
        },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      // Send notification to supervisor (C25 → C26/C27)
      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `New Delivery Request - Booking ${bookingId}`,
        html: `
          <h2>New Delivery Request</h2>
          <p>A customer has requested delivery for their booking.</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Customer:</strong> ${booking.customer.firstName} ${booking.customer.lastName}</p>
          <p><strong>Delivery Address:</strong> ${deliveryAddress}</p>
          <p><strong>Preferred Date:</strong> ${new Date(preferredDate).toLocaleDateString()}</p>
          <p><strong>Urgency:</strong> ${urgency || 'standard'}</p>
          <p>Please review and approve/reject this delivery request.</p>
        `,
      });

      res.json(deliveryRequest);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery request", error });
    }
  }

  // Get delivery requests for customer
  async getCustomerDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      const deliveryRequests = await prisma.deliveryRequest.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      res.json(deliveryRequests);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery requests", error });
    }
  }

  // Get all delivery requests for supervisor
  async getAllDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      // Only supervisor can view all delivery requests
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      const deliveryRequests = await prisma.deliveryRequest.findMany({
        where: status ? { status: status as any } : {},
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      res.json(deliveryRequests);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery requests", error });
    }
  }

  // Supervisor approves delivery request (C26)
  async approveDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const supervisorId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only supervisor can approve delivery requests
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryRequest = await prisma.deliveryRequest.update({
        where: { id },
        data: {
          status: "scheduled",
          updatedAt: new Date()
        },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      console.log("Delivery request approved:", {
        id: deliveryRequest.id,
        bookingId: deliveryRequest.bookingId,
        customerId: deliveryRequest.customerId,
        warehouseId: deliveryRequest.booking?.warehouseId
      });

      // Create delivery advice (C26 → Delivery Advice)
      const deliveryAdvice = await prisma.deliveryAdvice.create({
        data: {
          bookingId: deliveryRequest.bookingId,
          customerId: deliveryRequest.customerId,
          deliveryAddress: deliveryRequest.deliveryAddress,
          preferredDate: deliveryRequest.preferredDate,
          urgency: deliveryRequest.urgency,
          status: "created",
          instructions: `Delivery approved by supervisor. Original request: ${deliveryRequest.id}`
        }
      });

      // Automatically create delivery order from delivery advice
      const orderNumber = `DO-${Date.now()}-${deliveryRequest.bookingId.slice(-6)}`;
      
      try {
        const deliveryOrder = await prisma.deliveryOrder.create({
          data: {
            deliveryAdviceId: deliveryAdvice.id,
            bookingId: deliveryRequest.bookingId,
            customerId: deliveryRequest.customerId,
            warehouseId: deliveryRequest.booking.warehouseId,
            orderNumber,
            status: "created"
          }
        });
        
        console.log("Delivery order created successfully:", {
          orderId: deliveryOrder.id,
          orderNumber: deliveryOrder.orderNumber,
          warehouseId: deliveryOrder.warehouseId
        });
      } catch (orderError) {
        console.error("Failed to create delivery order:", orderError);
        // Continue with the response even if delivery order creation fails
        // The delivery advice was created successfully
      }

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryRequest.booking.customer.email,
        subject: `Delivery Request Approved - Booking ${deliveryRequest.bookingId}`,
        html: `
          <h2>Delivery Request Approved</h2>
          <p>Your delivery request has been approved by the supervisor.</p>
          <p><strong>Booking ID:</strong> ${deliveryRequest.bookingId}</p>
          <p><strong>Delivery Address:</strong> ${deliveryRequest.deliveryAddress}</p>
          <p><strong>Preferred Date:</strong> ${deliveryRequest.preferredDate.toLocaleDateString()}</p>
          <p><strong>Urgency:</strong> ${deliveryRequest.urgency}</p>
          <p>Delivery advice has been created and will be processed by the warehouse.</p>
        `,
      });

      // Send notification to warehouse
      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Delivery Order Created - ${orderNumber}`,
        html: `
          <h2>Delivery Order Created</h2>
          <p>A delivery order has been created for the following booking.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Booking ID:</strong> ${deliveryRequest.bookingId}</p>
          <p><strong>Customer:</strong> ${deliveryRequest.booking.customer.firstName} ${deliveryRequest.booking.customer.lastName}</p>
          <p><strong>Delivery Address:</strong> ${deliveryRequest.deliveryAddress}</p>
          <p><strong>Preferred Date:</strong> ${deliveryRequest.preferredDate.toLocaleDateString()}</p>
          <p>Please acknowledge and execute this delivery order.</p>
        `,
      });

      res.json({ deliveryRequest, deliveryAdvice });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve delivery request", error });
    }
  }

  // Supervisor rejects delivery request (C27)
  async rejectDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Only supervisor can reject delivery requests
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryRequest = await prisma.deliveryRequest.update({
        where: { id },
        data: {
          status: "delivery_advice_created", // Using enum value for rejected
          updatedAt: new Date()
        },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } }
            }
          }
        }
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryRequest.booking.customer.email,
        subject: `Delivery Request Rejected - Booking ${deliveryRequest.bookingId}`,
        html: `
          <h2>Delivery Request Rejected</h2>
          <p>Your delivery request has been rejected by the supervisor.</p>
          <p><strong>Booking ID:</strong> ${deliveryRequest.bookingId}</p>
          <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          <p>Please contact support if you have any questions.</p>
        `,
      });

      res.json(deliveryRequest);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject delivery request", error });
    }
  }

  // Get delivery request by ID
  async getDeliveryRequestById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user! as any;

      const deliveryRequest = await prisma.deliveryRequest.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      if (!deliveryRequest) {
        return res.status(404).json({ message: "Delivery request not found" });
      }

      // Check permissions
      if (user.role === "customer" && deliveryRequest.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      res.json(deliveryRequest);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery request", error });
    }
  }
}

export const deliveryRequestController = new DeliveryRequestController();

