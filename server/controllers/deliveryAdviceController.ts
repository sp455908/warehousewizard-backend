import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class DeliveryAdviceController {
  async createDeliveryAdvice(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId, deliveryAddress, preferredDate, urgency, instructions } = req.body;
      
      // Only supervisor can create delivery advice
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get booking details
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const deliveryAdvice = await prisma.deliveryAdvice.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          deliveryAddress,
          preferredDate: new Date(preferredDate),
          urgency: urgency || "standard",
          instructions,
          status: "created",
        },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      // Send notification to customer and warehouse
      await notificationService.sendEmail({
        to: (deliveryAdvice.customer as any).email,
        subject: `Delivery Advice Created - Booking ${bookingId}`,
        html: `
          <h2>Delivery Advice Created</h2>
          <p>Delivery advice has been created for your booking.</p>
          <p>Booking ID: ${bookingId}</p>
          <p>Delivery Address: ${deliveryAddress}</p>
          <p>Preferred Date: ${new Date(preferredDate).toLocaleDateString()}</p>
          <p>Urgency: ${urgency || 'Standard'}</p>
          <p>Instructions: ${instructions || 'None'}</p>
        `,
      });

      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Delivery Advice Created - Booking ${bookingId}`,
        html: `
          <h2>Delivery Advice Created</h2>
          <p>Delivery advice has been created for booking ${bookingId}.</p>
          <p>Customer: ${(booking.customer as any).firstName} ${(booking.customer as any).lastName}</p>
          <p>Delivery Address: ${deliveryAddress}</p>
          <p>Preferred Date: ${new Date(preferredDate).toLocaleDateString()}</p>
          <p>Urgency: ${urgency || 'Standard'}</p>
          <p>Instructions: ${instructions || 'None'}</p>
        `,
      });

      res.status(201).json(deliveryAdvice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery advice", error });
    }
  }

  async getDeliveryAdvices(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let deliveryAdvices;

      if (user.role === "customer") {
        // Get delivery advices for this customer
        deliveryAdvices = await prisma.deliveryAdvice.findMany({
          where: { customerId: user.id },
          include: {
            booking: { 
              include: { 
                warehouse: { select: { name: true, location: true } }
              }
            },
            deliveryOrders: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        // Get all delivery advices for supervisor, admin
        deliveryAdvices = await prisma.deliveryAdvice.findMany({
          include: {
            booking: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true } }
              }
            },
            customer: { select: { firstName: true, lastName: true, email: true } },
            deliveryOrders: true
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      res.json(deliveryAdvices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery advices", error });
    }
  }

  async getDeliveryAdviceById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const deliveryAdvice = await prisma.deliveryAdvice.findUnique({
        where: { id },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          deliveryOrders: {
            include: {
              deliveryReports: true
            }
          }
        }
      });

      if (!deliveryAdvice) {
        return res.status(404).json({ message: "Delivery advice not found" });
      }

      res.json(deliveryAdvice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery advice", error });
    }
  }

  async updateDeliveryAdvice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const deliveryAdvice = await prisma.deliveryAdvice.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      res.json(deliveryAdvice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery advice", error });
    }
  }

  async getDeliveryAdvicesByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const deliveryAdvices = await prisma.deliveryAdvice.findMany({
        where: { bookingId },
        include: {
          deliveryOrders: {
            include: {
              deliveryReports: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(deliveryAdvices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery advices by booking", error });
    }
  }
}

export const deliveryAdviceController = new DeliveryAdviceController();