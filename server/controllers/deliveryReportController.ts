import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { notificationService } from "../services/notificationService";

export class DeliveryReportController {
  // Warehouse creates delivery report (C33)
  async createDeliveryReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        deliveryOrderId, 
        deliveredAt, 
        pod, 
        grn, 
        quantities, 
        exceptions,
        quantityDispatched,
        vehicleNumber,
        driverContactNumber,
        dispatchDate
      } = req.body;

      // Only warehouse can create delivery reports
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get delivery order details
      const deliveryOrder = await prisma.deliveryOrder.findUnique({
        where: { id: deliveryOrderId },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      });

      if (!deliveryOrder) {
        return res.status(404).json({ message: "Delivery order not found" });
      }

      // TODO: Add proper user-to-warehouse mapping validation
      // For now, allow warehouse users to create reports for any delivery order
      // since there's no direct user-warehouse relationship in the current schema

      // Use the warehouseId from the delivery order
      const warehouseId = deliveryOrder.warehouseId;

      console.log("[DeliveryReport] Creating report for warehouseId:", warehouseId, "deliveryOrderId:", deliveryOrderId);

      // Generate delivery report number
      const reportNumber = `DR-${Date.now()}-${deliveryOrder.bookingId.slice(-6)}`;

      const deliveryReport = await prisma.deliveryReport.create({
        data: {
          deliveryOrderId,
          bookingId: deliveryOrder.bookingId,
          customerId: deliveryOrder.customerId,
          warehouseId,
          reportNumber,
          deliveredAt: new Date(deliveredAt),
          pod: pod || null,
          grn: grn || null,
          quantities: quantities || 0,
          exceptions: exceptions || null,
          // Dispatch Details
          quantityDispatched: quantityDispatched || null,
          vehicleNumber: vehicleNumber || null,
          driverContactNumber: driverContactNumber || null,
          dispatchDate: dispatchDate ? new Date(dispatchDate) : null,
          status: "created"
        },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      console.log("[DeliveryReport] Created delivery report:", deliveryReport.id, "warehouseId:", deliveryReport.warehouseId);

      // Update delivery order status to completed
      await prisma.deliveryOrder.update({
        where: { id: deliveryOrderId },
        data: {
          status: "executed",
          updatedAt: new Date()
        }
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: deliveryOrder.booking.customer.email,
        subject: `Delivery Report Created - ${reportNumber}`,
        html: `
          <h2>Delivery Report Created</h2>
          <p>Your delivery has been completed and a delivery report has been generated.</p>
          <p><strong>Report Number:</strong> ${reportNumber}</p>
          <p><strong>Order Number:</strong> ${deliveryOrder.orderNumber}</p>
          <p><strong>Booking ID:</strong> ${deliveryOrder.bookingId}</p>
          <p><strong>Delivered At:</strong> ${new Date(deliveredAt).toLocaleString()}</p>
          <p><strong>POD:</strong> ${pod || 'Not provided'}</p>
          <p><strong>GRN:</strong> ${grn || 'Not provided'}</p>
          <p><strong>Quantities:</strong> ${quantities || 0}</p>
          ${quantityDispatched ? `<p><strong>Quantity Dispatched:</strong> ${quantityDispatched}</p>` : ''}
          ${vehicleNumber ? `<p><strong>Vehicle Number:</strong> ${vehicleNumber}</p>` : ''}
          ${driverContactNumber ? `<p><strong>Driver Contact:</strong> ${driverContactNumber}</p>` : ''}
          ${dispatchDate ? `<p><strong>Dispatch Date:</strong> ${new Date(dispatchDate).toLocaleString()}</p>` : ''}
          ${exceptions ? `<p><strong>Exceptions:</strong> ${exceptions}</p>` : ''}
          <p>Thank you for using our warehouse services!</p>
        `,
      });

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `Delivery Report Created - ${reportNumber}`,
        html: `
          <h2>Delivery Report Created</h2>
          <p>A delivery report has been created by the warehouse.</p>
          <p><strong>Report Number:</strong> ${reportNumber}</p>
          <p><strong>Order Number:</strong> ${deliveryOrder.orderNumber}</p>
          <p><strong>Booking ID:</strong> ${deliveryOrder.bookingId}</p>
          <p><strong>Customer:</strong> ${deliveryOrder.booking.customer.firstName} ${deliveryOrder.booking.customer.lastName}</p>
          <p><strong>Delivered At:</strong> ${new Date(deliveredAt).toLocaleString()}</p>
          <p><strong>Quantities:</strong> ${quantities || 0}</p>
          ${quantityDispatched ? `<p><strong>Quantity Dispatched:</strong> ${quantityDispatched}</p>` : ''}
          ${vehicleNumber ? `<p><strong>Vehicle Number:</strong> ${vehicleNumber}</p>` : ''}
          ${driverContactNumber ? `<p><strong>Driver Contact:</strong> ${driverContactNumber}</p>` : ''}
          ${dispatchDate ? `<p><strong>Dispatch Date:</strong> ${new Date(dispatchDate).toLocaleString()}</p>` : ''}
          <p>The delivery process has been completed successfully.</p>
        `,
      });

      res.json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery report", error });
    }
  }

  // Get all delivery reports for warehouse
  async getWarehouseDeliveryReports(req: AuthenticatedRequest, res: Response) {
    try {
      // Only warehouse can view delivery reports
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      console.log("[DeliveryReport] GET /api/delivery-reports/warehouse → User:", (req.user! as any).id, "Role:", (req.user! as any).role);

      // Since there's no direct user-warehouse relationship in the schema,
      // warehouse users can view all delivery reports
      // TODO: Implement proper user-warehouse mapping if needed
      const deliveryReports = await prisma.deliveryReport.findMany({
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
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      console.log("[DeliveryReport] GET /api/delivery-reports/warehouse → Found reports:", deliveryReports.length);
      res.json(deliveryReports);
      return;
    } catch (error) {
      console.error("[DeliveryReport] GET /api/delivery-reports/warehouse → Error:", error);
      return res.status(500).json({ message: "Failed to fetch delivery reports", error });
    }
  }

  // Get all delivery reports for supervisor
  async getAllDeliveryReports(req: AuthenticatedRequest, res: Response) {
    try {
      // Only supervisor can view all delivery reports
      if ((req.user! as any).role !== "supervisor") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      const deliveryReports = await prisma.deliveryReport.findMany({
        where: status ? { status: status as any } : {},
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      res.json(deliveryReports);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery reports", error });
    }
  }

  // Get delivery reports for customer
  async getCustomerDeliveryReports(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only customers can view their delivery reports
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryReports = await prisma.deliveryReport.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      res.json(deliveryReports);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery reports", error });
    }
  }

  // Get delivery report by ID
  async getDeliveryReportById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user! as any;

      const deliveryReport = await prisma.deliveryReport.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!deliveryReport) {
        return res.status(404).json({ message: "Delivery report not found" });
      }

      // Check permissions
      if (user.role === "customer" && deliveryReport.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (user.role === "warehouse" && deliveryReport.warehouseId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      res.json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery report", error });
    }
  }

  // Update delivery report status
  async updateDeliveryReportStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user! as any;

      // Only warehouse can update delivery report status
      if (user.role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const deliveryReport = await prisma.deliveryReport.update({
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

      res.json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery report status", error });
    }
  }
}

export const deliveryReportController = new DeliveryReportController();