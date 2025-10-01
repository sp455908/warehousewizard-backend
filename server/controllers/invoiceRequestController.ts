import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { notificationService } from "../services/notificationService";

export class InvoiceRequestController {
  // Customer creates invoice request (C28)
  async createInvoiceRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId, amount, dueDate } = req.body;
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only customers can create invoice requests
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Verify booking exists and belongs to customer
      const booking = await prisma.booking.findFirst({
        where: { 
          id: bookingId, 
          customerId,
          status: "confirmed" // Only confirmed bookings can have invoice requests
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found or not confirmed" });
      }

      // Check if invoice already exists for this booking
      const existingInvoice = await prisma.invoice.findFirst({
        where: { bookingId }
      });

      if (existingInvoice) {
        return res.status(409).json({ message: "Invoice already exists for this booking" });
      }

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${bookingId.slice(-6)}`;

      const invoice = await prisma.invoice.create({
        data: {
          bookingId,
          customerId,
          invoiceNumber,
          amount: parseFloat(amount),
          dueDate: new Date(dueDate),
          status: "draft"
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

      // Send notification to warehouse (C28 → C29/C30)
      await notificationService.sendEmail({
        to: "warehouse@example.com", // TODO: Get actual warehouse email
        subject: `Invoice Request - Booking ${bookingId}`,
        html: `
          <h2>Invoice Request</h2>
          <p>A customer has requested an invoice for their booking.</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Customer:</strong> ${booking.customer.firstName} ${booking.customer.lastName}</p>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount:</strong> ₹${amount}</p>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          <p>Please review and approve/reject this invoice request.</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create invoice request", error });
    }
  }

  // Get invoice requests for customer
  async getCustomerInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      const invoices = await prisma.invoice.findMany({
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

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch invoices", error });
    }
  }

  // Get all invoices for warehouse
  async getAllInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      // Only warehouse can view all invoices
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { status } = req.query;

      const invoices = await prisma.invoice.findMany({
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

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch invoices", error });
    }
  }

  // Warehouse approves invoice request (C29)
  async approveInvoiceRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const warehouseId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only warehouse can approve invoice requests
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: "sent",
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

      // Send notification to customer
      await notificationService.sendEmail({
        to: invoice.booking.customer.email,
        subject: `Invoice Approved - ${invoice.invoiceNumber}`,
        html: `
          <h2>Invoice Approved</h2>
          <p>Your invoice request has been approved by the warehouse.</p>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Booking ID:</strong> ${invoice.bookingId}</p>
          <p><strong>Amount:</strong> ₹${invoice.amount.toLocaleString()}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
          <p>Please proceed with payment submission.</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve invoice request", error });
    }
  }

  // Warehouse rejects invoice request (C30)
  async rejectInvoiceRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Only warehouse can reject invoice requests
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: "cancelled",
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
        to: invoice.booking.customer.email,
        subject: `Invoice Request Rejected - ${invoice.invoiceNumber}`,
        html: `
          <h2>Invoice Request Rejected</h2>
          <p>Your invoice request has been rejected by the warehouse.</p>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Booking ID:</strong> ${invoice.bookingId}</p>
          <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          <p>Please contact support if you have any questions.</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject invoice request", error });
    }
  }

  // Customer submits payment details (C31)
  async submitPaymentDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { invoiceId, paymentMethod, transactionId, amount } = req.body;
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Only customers can submit payment details
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Verify invoice exists and belongs to customer
      const invoice = await prisma.invoice.findFirst({
        where: { 
          id: invoiceId, 
          customerId,
          status: "sent" // Only sent invoices can be paid
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found or not ready for payment" });
      }

      // Update invoice with payment details
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "paid",
          paidAt: new Date(),
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

      // Send notification to supervisor (C31 → C32)
      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        html: `
          <h2>Payment Received</h2>
          <p>Payment has been received for the following invoice.</p>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Booking ID:</strong> ${invoice.bookingId}</p>
          <p><strong>Amount:</strong> ₹${amount}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
          <p>Please proceed with delivery order generation.</p>
        `,
      });

      res.json(updatedInvoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to submit payment details", error });
    }
  }

  // Get invoice by ID
  async getInvoiceById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user! as any;

      const invoice = await prisma.invoice.findUnique({
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

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check permissions
      if (user.role === "customer" && invoice.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch invoice", error });
    }
  }
}

export const invoiceRequestController = new InvoiceRequestController();

