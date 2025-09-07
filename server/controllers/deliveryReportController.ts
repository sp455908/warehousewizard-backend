import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class DeliveryReportController {
  async createDeliveryReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { deliveryOrderId, bookingId, customerId, warehouseId, deliveredAt, pod, grn, quantities, exceptions } = req.body;
      
      // Only warehouse can create delivery reports
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Generate delivery report number
      const reportNumber = await this.generateDeliveryReportNumber();

      const deliveryReport = await prisma.deliveryReport.create({
        data: {
          deliveryOrderId,
          bookingId,
          customerId,
          warehouseId,
          reportNumber,
          deliveredAt: new Date(deliveredAt),
          pod,
          grn,
          quantities: quantities || {},
          exceptions,
          status: "created",
        },
        include: {
          deliveryOrder: true,
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

      // Send notification to customer and supervisor
      await notificationService.sendEmail({
        to: (deliveryReport.customer as any).email,
        subject: `Delivery Report Created - ${reportNumber}`,
        html: `
          <h2>Delivery Report Created</h2>
          <p>Delivery report has been created for your order.</p>
          <p>Report Number: ${reportNumber}</p>
          <p>Booking ID: ${bookingId}</p>
          <p>Delivered At: ${new Date(deliveredAt).toLocaleString()}</p>
          <p>Warehouse: ${(deliveryReport.warehouse as any).name}</p>
          <p>POD: ${pod || 'Not provided'}</p>
          <p>GRN: ${grn || 'Not provided'}</p>
          ${exceptions ? `<p>Exceptions: ${exceptions}</p>` : ''}
        `,
      });

      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `Delivery Report Created - ${reportNumber}`,
        html: `
          <h2>Delivery Report Created</h2>
          <p>Warehouse ${(deliveryReport.warehouse as any).name} has created a delivery report.</p>
          <p>Report Number: ${reportNumber}</p>
          <p>Booking ID: ${bookingId}</p>
          <p>Customer: ${(deliveryReport.customer as any).firstName} ${(deliveryReport.customer as any).lastName}</p>
          <p>Delivered At: ${new Date(deliveredAt).toLocaleString()}</p>
          <p>POD: ${pod || 'Not provided'}</p>
          <p>GRN: ${grn || 'Not provided'}</p>
          ${exceptions ? `<p>Exceptions: ${exceptions}</p>` : ''}
        `,
      });

      res.status(201).json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create delivery report", error });
    }
  }

  async getDeliveryReports(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let deliveryReports;

      if (user.role === "customer") {
        // Get delivery reports for this customer
        deliveryReports = await prisma.deliveryReport.findMany({
          where: { customerId: user.id },
          include: {
            deliveryOrder: true,
            booking: { 
              include: { 
                warehouse: { select: { name: true, location: true } }
              }
            },
            warehouse: { select: { name: true, location: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      } else if (user.role === "warehouse") {
        // Get delivery reports for this warehouse
        deliveryReports = await prisma.deliveryReport.findMany({
          where: { warehouseId: user.id },
          include: {
            deliveryOrder: true,
            booking: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } }
              }
            },
            customer: { select: { firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        // Get all delivery reports for supervisor, admin
        deliveryReports = await prisma.deliveryReport.findMany({
          include: {
            deliveryOrder: true,
            booking: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true } }
              }
            },
            customer: { select: { firstName: true, lastName: true, email: true } },
            warehouse: { select: { name: true, location: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      res.json(deliveryReports);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery reports", error });
    }
  }

  async getDeliveryReportById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const deliveryReport = await prisma.deliveryReport.findUnique({
        where: { id },
        include: {
          deliveryOrder: true,
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!deliveryReport) {
        return res.status(404).json({ message: "Delivery report not found" });
      }

      res.json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery report", error });
    }
  }

  async updateDeliveryReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const deliveryReport = await prisma.deliveryReport.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          deliveryOrder: true,
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

      res.json(deliveryReport);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update delivery report", error });
    }
  }

  async getDeliveryReportsByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.params;
      const deliveryReports = await prisma.deliveryReport.findMany({
        where: { bookingId },
        include: {
          deliveryOrder: true,
          warehouse: { select: { name: true, location: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(deliveryReports);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery reports by booking", error });
    }
  }

  async getDeliveryReportsByDeliveryOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { deliveryOrderId } = req.params;
      const deliveryReports = await prisma.deliveryReport.findMany({
        where: { deliveryOrderId },
        include: {
          booking: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          },
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(deliveryReports);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch delivery reports by delivery order", error });
    }
  }

  private async generateDeliveryReportNumber(): Promise<string> {
    const prefix = "DR";
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of delivery reports this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await prisma.deliveryReport.count({
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

export const deliveryReportController = new DeliveryReportController();