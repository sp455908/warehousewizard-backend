import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class DeliveryOrderController {
  async createDeliveryOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { deliveryAdviceId, bookingId, customerId, warehouseId } = req.body;
      
      // Only supervisor can create delivery orders
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Generate delivery order number
      const orderNumber = await this.generateDeliveryOrderNumber();

      const deliveryOrder = await prisma.deliveryOrder.create({
        data: {
          deliveryAdviceId,
          bookingId,
          customerId,
          warehouseId,
          orderNumber,
          status: "created",
        },
        include: {
          deliveryAdvice: true,
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to customer and warehouse
      await notificationService.sendEmail({
        to: (deliveryOrder.customer as any).email,
        subject: `Delivery Order Created - ${orderNumber}`,
        html: `
          <h2>Delivery Order Created</h2>
          <p>Delivery order has been created for your booking.</p>
          <p>Order Number: ${orderNumber}</p>
          <p>Booking ID: ${bookingId}</p>
          <p>Warehouse: ${(deliveryOrder.warehouse as any).name}</p>
          <p>Location: ${(deliveryOrder.warehouse as any).location}</p>
          <p>Created At: ${new Date().toLocaleString()}</p>
        `,
      });

      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Delivery Order Created - ${orderNumber}`,
        html: `
          <h2>Delivery Order Created</h2>
          <p>Delivery order has been created for booking ${bookingId}.</p>
          <p>Order Number: ${orderNumber}</p>
          <p>Customer: ${(deliveryOrder.customer as any).firstName} ${(deliveryOrder.customer as any).lastName}</p>
          <p>Created At: ${new Date().toLocaleString()}</p>
        `,
      });

      res.status(201).json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery order", error });
    }
  }

  async getDeliveryOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let deliveryOrders;

      if (user.role === "customer") {
        // Get delivery orders for this customer
        deliveryOrders = await prisma.deliveryOrder.findMany({
          where: { customerId: user.id },
          include: {
            deliveryAdvice: true,
            booking: { 
              include: { 
                warehouse: { select: { name: true, location: true } }
              }
            },
            warehouse: { select: { name: true, location: true } },
            deliveryReports: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } else if (user.role === "warehouse") {
        // Get delivery orders for this warehouse
        deliveryOrders = await prisma.deliveryOrder.findMany({
          where: { warehouseId: user.id },
          include: {
            deliveryAdvice: true,
            booking: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } }
              }
            },
            customer: { select: { firstName: true, lastName: true, email: true } },
            deliveryReports: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        // Get all delivery orders for supervisor, admin
        deliveryOrders = await prisma.deliveryOrder.findMany({
          include: {
            deliveryAdvice: true,
            booking: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true } }
              }
            },
            customer: { select: { firstName: true, lastName: true, email: true } },
            warehouse: { select: { name: true, location: true } },
            deliveryReports: true
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      res.json(deliveryOrders);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery orders", error });
    }
  }

  async getDeliveryOrderById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const deliveryOrder = await prisma.deliveryOrder.findUnique({
        where: { id },
        include: {
          deliveryAdvice: true,
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          deliveryReports: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!deliveryOrder) {
        return res.status(404).json({ message: "Delivery order not found" });
      }

      res.json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery order", error });
    }
  }

  async updateDeliveryOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const deliveryOrder = await prisma.deliveryOrder.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          deliveryAdvice: true,
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      res.json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery order", error });
    }
  }

  async getDeliveryOrdersByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const deliveryOrders = await prisma.deliveryOrder.findMany({
        where: { bookingId },
        include: {
          deliveryAdvice: true,
          warehouse: { select: { name: true, location: true } },
          deliveryReports: {
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(deliveryOrders);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery orders by booking", error });
    }
  }

  private async generateDeliveryOrderNumber(): Promise<string> {
    const prefix = "DO";
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of delivery orders this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await prisma.deliveryOrder.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    
    return `${prefix}-${year}${month}-${sequence}`;
  }
}

export const deliveryOrderController = new DeliveryOrderController();