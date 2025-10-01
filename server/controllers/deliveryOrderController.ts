import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { notificationService } from "../services/notificationService";

export class DeliveryOrderController {
  // Supervisor creates delivery order (C32)
  async createDeliveryOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { deliveryAdviceId, warehouseId } = req.body;
      const supervisorId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only supervisor can create delivery orders
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get delivery advice details
      const deliveryAdvice = await prisma.deliveryAdvice.findUnique({
        where: { id: deliveryAdviceId },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      if (!deliveryAdvice) {
        return res.status(404).json({ message: "Delivery advice not found" });
      }

      // Generate delivery order number
      const orderNumber = `DO-${Date.now()}-${deliveryAdvice.bookingId.slice(-6)}`;

      const deliveryOrder = await prisma.deliveryOrder.create({
        data: {
          deliveryAdviceId,
          bookingId: deliveryAdvice.bookingId,
          customerId: deliveryAdvice.customerId,
          warehouseId,
          orderNumber,
          status: "created"
        },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryAdvice: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to warehouse (C32 → C33)
      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Delivery Order Created - ${orderNumber}`,
        html: `
          <h2>Delivery Order Created</h2>
          <p>A delivery order has been created for the following booking.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Booking ID:</strong> ${deliveryAdvice.bookingId}</p>
          <p><strong>Customer:</strong> ${deliveryAdvice.booking.customer.firstName} ${deliveryAdvice.booking.customer.lastName}</p>
          <p><strong>Delivery Address:</strong> ${deliveryAdvice.deliveryAddress}</p>
          <p><strong>Preferred Date:</strong> ${deliveryAdvice.preferredDate.toLocaleDateString()}</p>
          <p><strong>Urgency:</strong> ${deliveryAdvice.urgency}</p>
          <p>Please prepare and execute the delivery.</p>
        `,
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryAdvice.booking.customer.email,
        subject: `Delivery Order Created - ${orderNumber}`,
        html: `
          <h2>Delivery Order Created</h2>
          <p>Your delivery order has been created and is being processed.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Booking ID:</strong> ${deliveryAdvice.bookingId}</p>
          <p><strong>Delivery Address:</strong> ${deliveryAdvice.deliveryAddress}</p>
          <p><strong>Preferred Date:</strong> ${deliveryAdvice.preferredDate.toLocaleDateString()}</p>
          <p>The warehouse will prepare your delivery and provide updates.</p>
        `,
      });

      res.json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery order", error });
    }
  }

  // Get all delivery orders for supervisor
  async getAllDeliveryOrders(req: AuthenticatedRequest, res: Response) {
    try {
      // Only supervisor can view all delivery orders
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      const deliveryOrders = await prisma.deliveryOrder.findMany({
        where: status ? { status: status as any } : {},
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryAdvice: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      res.json(deliveryOrders);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery orders", error });
    }
  }

  // Get delivery orders for warehouse
  async getWarehouseDeliveryOrders(req: AuthenticatedRequest, res: Response) {
    try {
      // Only warehouse can view delivery orders via this route
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      // NOTE: Temporarily show all delivery orders to warehouse users because
      // there is no reliable user→warehouse mapping yet (User.id != Warehouse.id).
      // Proper scoping should be added when mapping exists.
      const deliveryOrders = await prisma.deliveryOrder.findMany({
        where: {
          ...(status ? { status: status as any } : {})
        },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryAdvice: true
        }
      });

      res.json(deliveryOrders);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery orders", error });
    }
  }

  // Get delivery order by ID
  async getDeliveryOrderById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user! as any;

      const deliveryOrder = await prisma.deliveryOrder.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryAdvice: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!deliveryOrder) {
        return res.status(404).json({ message: "Delivery order not found" });
      }

      // Check permissions
      if (user.role === "warehouse" && deliveryOrder.warehouseId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      res.json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery order", error });
    }
  }

  // Update delivery order status
  async updateDeliveryOrderStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user! as any;

      // Only warehouse can update delivery order status
      if (user.role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryOrder = await prisma.deliveryOrder.update({
        where: { id },
        data: {
          status: status as any,
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

      // Send notification to customer if status is executed
      if (status === "executed") {
        await notificationService.sendEmail({
          to: deliveryOrder.booking.customer.email,
          subject: `Delivery Order Executed - ${deliveryOrder.orderNumber}`,
          html: `
            <h2>Delivery Order Executed</h2>
            <p>Your delivery order has been executed by the warehouse.</p>
            <p><strong>Order Number:</strong> ${deliveryOrder.orderNumber}</p>
            <p><strong>Booking ID:</strong> ${deliveryOrder.bookingId}</p>
            <p>The warehouse will now prepare the delivery report.</p>
          `,
        });
      }

      res.json(deliveryOrder);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery order status", error });
    }
  }
}

export const deliveryOrderController = new DeliveryOrderController();