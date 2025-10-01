import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

const db: any = prisma;

export class InvoiceController {
  async createInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const invoiceData = req.body;
      
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();
      
      const invoice = await prisma.invoice.create({
        data: {
          ...invoiceData,
          invoiceNumber,
        }
      });

      res.status(201).json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to create invoice", error });
    }
  }

  async getInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { status } = req.query;
      
      let filter: any = {};
      
      if (user.role === "customer") {
        filter.customerId = user.id || user._id?.toString();
      }
      
      if (status) {
        filter.status = status;
      } else {
        // Default filter based on role
        if (user.role === "accounts") {
          filter.status = "sent";
        }
      }

      const invoices = await prisma.invoice.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true } }
        }
      });

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch invoices", error });
    }
  }

  async getInvoiceById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true, mobile: true } },
          booking: { select: { warehouseId: true, customerId: true, totalAmount: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check permissions
      const user = req.user! as any;
      if (user.role === "customer" && invoice.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch invoice", error });
    }
  }

  async updateInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const invoice = await prisma.invoice.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          booking: true
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update invoice", error });
    }
  }

  async deleteInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.delete({
        where: { id }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json({ message: "Invoice deleted successfully" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete invoice", error });
    }
  }

  async sendInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "sent",
          updatedAt: new Date()
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Send invoice email
      await notificationService.sendEmail({
        to: (invoice as any).customer.email,
        subject: `Invoice ${invoice.invoiceNumber} - Warehouse Wizard`,
        html: `
          <h2>Invoice ₹{invoice.invoiceNumber}</h2>
          <p>Dear ${(invoice as any).customer.firstName} ${(invoice as any).customer.lastName},</p>
          <p>Please find your invoice details below:</p>
          <p>Amount: ₹{invoice.amount}</p>
          <p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p>Please log in to your dashboard to view the complete invoice and make payment.</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to send invoice", error });
    }
  }

  async markAsPaid(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { paymentMethod, transactionId } = req.body;

      const invoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Send payment confirmation
      await notificationService.sendEmail({
        to: (invoice as any).customer.email,
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        html: `
          <h2>Payment Received</h2>
          <p>Dear ${(invoice as any).customer.firstName} ${(invoice as any).customer.lastName},</p>
          <p>We have received your payment for invoice ${invoice.invoiceNumber}.</p>
          <p>Amount Paid: ₹{invoice.amount}</p>
          <p>Payment Date: ${new Date().toLocaleDateString()}</p>
          <p>Thank you for your business!</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to mark invoice as paid", error });
    }
  }

  async markAsOverdue(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "overdue",
          updatedAt: new Date()
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Send overdue notice
      await notificationService.sendEmail({
        to: (invoice as any).customer.email,
        subject: `Overdue Notice - Invoice ${invoice.invoiceNumber}`,
        html: `
          <h2>Payment Overdue</h2>
          <p>Dear ${(invoice as any).customer.firstName} ${(invoice as any).customer.lastName},</p>
          <p>Your invoice ${invoice.invoiceNumber} is now overdue.</p>
          <p>Amount Due: ₹{invoice.amount}</p>
          <p>Original Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p>Please make payment as soon as possible to avoid any service interruption.</p>
        `,
      });

      res.json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to mark invoice as overdue", error });
    }
  }

  async payInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { paymentMethod, paymentDetails } = req.body;
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();

      // Verify the invoice belongs to the customer
      const invoice = await prisma.invoice.findFirst({ 
        where: { id, customerId } 
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.status === "paid") {
        return res.status(400).json({ message: "Invoice already paid" });
      }

      // Process payment (integrate with payment gateway)
      // For now, we'll just mark as paid
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Send confirmation
      await notificationService.sendEmail({
        to: (req.user! as any).email,
        subject: `Payment Confirmation - Invoice ${invoice.invoiceNumber}`,
        html: `
          <h2>Payment Successful</h2>
          <p>Your payment has been processed successfully.</p>
          <p>Invoice: ${invoice.invoiceNumber}</p>
          <p>Amount: ₹{invoice.amount}</p>
          <p>Payment Method: ${paymentMethod}</p>
        `,
      });

      res.json(updatedInvoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to process payment", error });
    }
  }

  async generateInvoicePDF(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true, totalAmount: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check permissions
      const user = req.user! as any;
      if (user.role === "customer" && invoice.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate PDF (you'll need to implement PDF generation)
      // For now, return invoice data
      res.json({
        message: "PDF generation not implemented yet",
        invoice
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to generate PDF", error });
    }
  }

  // Status-specific getters
  async getDraftInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const invoices = await prisma.invoice.findMany({
        where: { status: "draft" },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true } }
        }
      });

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch draft invoices", error });
    }
  }

  async getSentInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let filter: any = { status: "sent" };

      if (user.role === "customer") {
        filter.customerId = user.id || user._id?.toString();
      }

      const invoices = await prisma.invoice.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true } }
        }
      });

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch sent invoices", error });
    }
  }

  async getPaidInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let filter: any = { status: "paid" };

      if (user.role === "customer") {
        filter.customerId = user.id || user._id?.toString();
      }

      const invoices = await prisma.invoice.findMany({
        where: filter,
        orderBy: { paidAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true } }
        }
      });

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch paid invoices", error });
    }
  }

  async getOverdueInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let filter: any = { status: "overdue" };

      if (user.role === "customer") {
        filter.customerId = user.id || user._id?.toString();
      }

      const invoices = await prisma.invoice.findMany({
        where: filter,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          booking: { select: { warehouseId: true } }
        }
      });

      res.json(invoices);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch overdue invoices", error });
    }
  }

  // Customer invoice request
  async requestInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { bookingId } = req.body;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      // Verify booking belongs to customer
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, customerId },
        include: { warehouse: { select: { name: true, location: true } } }
      });
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Check if invoice already exists
      const existingInvoice = await prisma.invoice.findFirst({
        where: { bookingId }
      });
      
      if (existingInvoice) {
        return res.status(400).json({ message: "Invoice already exists for this booking" });
      }
      
      // Create invoice request
      const invoice = await prisma.invoice.create({
        data: {
          bookingId,
          customerId,
          invoiceNumber: await this.generateInvoiceNumber(),
          amount: booking.totalAmount,
          status: "draft",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
      
      res.status(201).json(invoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to request invoice", error });
    }
  }

  // Customer payment detail submission
  async submitPaymentDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { paymentMethod, transactionId, paymentDate, amount } = req.body;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      // Verify invoice belongs to customer
      const invoice = await prisma.invoice.findFirst({
        where: { id, customerId }
      });
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Update invoice with payment details
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: "paid",
          paidAt: new Date(paymentDate || new Date()),
          updatedAt: new Date()
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
      
      // Send payment confirmation
      await notificationService.sendEmail({
        to: (updatedInvoice.customer as any).email,
        subject: "Payment Received - Warehouse Wizard",
        html: `
          <h2>Payment Received</h2>
          <p>Thank you for your payment.</p>
          <p>Invoice Number: ${updatedInvoice.invoiceNumber}</p>
          <p>Amount: ₹{updatedInvoice.amount}</p>
          <p>Payment Method: ${paymentMethod}</p>
          <p>Transaction ID: ${transactionId}</p>
          <p>Payment Date: ${new Date(paymentDate || new Date()).toLocaleDateString()}</p>
        `,
      });
      
      res.json(updatedInvoice);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to submit payment details", error });
    }
  }

  

  

  private async generateInvoiceNumber(): Promise<string> {
    const prefix = "INV";
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of invoices this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await prisma.invoice.count({
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

  // Warehouse: Accept/Reject invoice requests (A29-A30)
  async acceptInvoiceRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes, invoiceDetails } = req.body;
      
      // Only warehouse can accept invoice requests
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invoice = await prisma.invoice.findUnique({
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

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Update invoice status to accepted and add details
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "sent",
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

      // Send notification to customer
      await notificationService.sendEmail({
        to: invoice.customer?.email || "",
        subject: "Invoice Request Accepted - Warehouse Wizard",
        html: `
          <h2>Invoice Request Accepted</h2>
          <p>Your invoice request has been accepted and is being processed.</p>
          <p>Invoice Number: <strong>${invoice.invoiceNumber}</strong></p>
          <p>Amount: ₹{invoice.amount?.toFixed(2) || 'TBD'}</p>
          <p>Status: Accepted and ready for payment</p>
          <p>Please proceed with payment submission.</p>
        `
      });

      // Send notification to accounts
      await notificationService.sendEmail({
        to: "accounts@warehousewizard.com", // This should be dynamic
        subject: "Invoice Request Accepted - Payment Processing Required",
        html: `
          <h2>Invoice Request Accepted</h2>
          <p>Customer: ${invoice.customer?.firstName} ${invoice.customer?.lastName}</p>
          <p>Invoice Number: ${invoice.invoiceNumber}</p>
          <p>Amount: ₹{invoice.amount?.toFixed(2) || 'TBD'}</p>
          <p>Please prepare for payment processing.</p>
        `
      });

      res.json({ message: "Invoice request accepted successfully", invoice: updatedInvoice });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept invoice request", error });
    }
  }

  async rejectInvoiceRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only warehouse can reject invoice requests
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { 
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Update invoice status to rejected
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { 
          status: "cancelled",
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: invoice.customer?.email || "",
        subject: "Invoice Request Update - Warehouse Wizard",
        html: `
          <h2>Invoice Request Update</h2>
          <p>Your invoice request has been reviewed and unfortunately cannot be processed at this time.</p>
          <p>Invoice Number: ${invoice.invoiceNumber}</p>
          <p>Reason: ${reason || "No specific reason provided"}</p>
          <p>Please contact our support team for more information or to submit a new request.</p>
        `
      });

      res.json({ message: "Invoice request rejected", invoice: updatedInvoice });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject invoice request", error });
    }
  }
}

export const invoiceController = new InvoiceController();