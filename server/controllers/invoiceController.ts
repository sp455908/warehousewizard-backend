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
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${(invoice as any).customer.firstName} ${(invoice as any).customer.lastName},</p>
          <p>Please find your invoice details below:</p>
          <p>Amount: $${invoice.amount}</p>
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
          <p>Amount Paid: $${invoice.amount}</p>
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
          <p>Amount Due: $${invoice.amount}</p>
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
          <p>Amount: $${invoice.amount}</p>
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
}

export const invoiceController = new InvoiceController();