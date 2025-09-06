"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceController = exports.InvoiceController = void 0;
const notificationService_1 = require("../services/notificationService");
const prisma_1 = require("../config/prisma");
const db = prisma_1.prisma;
class InvoiceController {
    async createInvoice(req, res) {
        try {
            const invoiceData = req.body;
            const invoiceNumber = await this.generateInvoiceNumber();
            const invoice = await prisma_1.prisma.invoice.create({
                data: {
                    ...invoiceData,
                    invoiceNumber,
                }
            });
            res.status(201).json(invoice);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create invoice", error });
        }
    }
    async getInvoices(req, res) {
        try {
            const user = req.user;
            const { status } = req.query;
            let filter = {};
            if (user.role === "customer") {
                filter.customerId = user.id || user._id?.toString();
            }
            if (status) {
                filter.status = status;
            }
            else {
                if (user.role === "accounts") {
                    filter.status = "sent";
                }
            }
            const invoices = await prisma_1.prisma.invoice.findMany({
                where: filter,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true } }
                }
            });
            res.json(invoices);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch invoices", error });
        }
    }
    async getInvoiceById(req, res) {
        try {
            const { id } = req.params;
            const invoice = await prisma_1.prisma.invoice.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, mobile: true } },
                    booking: { select: { warehouseId: true, customerId: true, totalAmount: true } }
                }
            });
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }
            const user = req.user;
            if (user.role === "customer" && invoice.customerId !== (user.id || user._id?.toString())) {
                return res.status(403).json({ message: "Access denied" });
            }
            res.json(invoice);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch invoice", error });
        }
    }
    async updateInvoice(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const invoice = await prisma_1.prisma.invoice.update({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update invoice", error });
        }
    }
    async deleteInvoice(req, res) {
        try {
            const { id } = req.params;
            const invoice = await prisma_1.prisma.invoice.delete({
                where: { id }
            });
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }
            res.json({ message: "Invoice deleted successfully" });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to delete invoice", error });
        }
    }
    async sendInvoice(req, res) {
        try {
            const { id } = req.params;
            const invoice = await prisma_1.prisma.invoice.update({
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
            await notificationService_1.notificationService.sendEmail({
                to: invoice.customer.email,
                subject: `Invoice ${invoice.invoiceNumber} - Warehouse Wizard`,
                html: `
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${invoice.customer.firstName} ${invoice.customer.lastName},</p>
          <p>Please find your invoice details below:</p>
          <p>Amount: $${invoice.amount}</p>
          <p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p>Please log in to your dashboard to view the complete invoice and make payment.</p>
        `,
            });
            res.json(invoice);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to send invoice", error });
        }
    }
    async markAsPaid(req, res) {
        try {
            const { id } = req.params;
            const { paymentMethod, transactionId } = req.body;
            const invoice = await prisma_1.prisma.invoice.update({
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
            await notificationService_1.notificationService.sendEmail({
                to: invoice.customer.email,
                subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
                html: `
          <h2>Payment Received</h2>
          <p>Dear ${invoice.customer.firstName} ${invoice.customer.lastName},</p>
          <p>We have received your payment for invoice ${invoice.invoiceNumber}.</p>
          <p>Amount Paid: $${invoice.amount}</p>
          <p>Payment Date: ${new Date().toLocaleDateString()}</p>
          <p>Thank you for your business!</p>
        `,
            });
            res.json(invoice);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to mark invoice as paid", error });
        }
    }
    async markAsOverdue(req, res) {
        try {
            const { id } = req.params;
            const invoice = await prisma_1.prisma.invoice.update({
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
            await notificationService_1.notificationService.sendEmail({
                to: invoice.customer.email,
                subject: `Overdue Notice - Invoice ${invoice.invoiceNumber}`,
                html: `
          <h2>Payment Overdue</h2>
          <p>Dear ${invoice.customer.firstName} ${invoice.customer.lastName},</p>
          <p>Your invoice ${invoice.invoiceNumber} is now overdue.</p>
          <p>Amount Due: $${invoice.amount}</p>
          <p>Original Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p>Please make payment as soon as possible to avoid any service interruption.</p>
        `,
            });
            res.json(invoice);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to mark invoice as overdue", error });
        }
    }
    async payInvoice(req, res) {
        try {
            const { id } = req.params;
            const { paymentMethod, paymentDetails } = req.body;
            const customerId = req.user.id || req.user._id?.toString();
            const invoice = await prisma_1.prisma.invoice.findFirst({
                where: { id, customerId }
            });
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }
            if (invoice.status === "paid") {
                return res.status(400).json({ message: "Invoice already paid" });
            }
            const updatedInvoice = await prisma_1.prisma.invoice.update({
                where: { id },
                data: {
                    status: "paid",
                    paidAt: new Date(),
                    updatedAt: new Date()
                }
            });
            await notificationService_1.notificationService.sendEmail({
                to: req.user.email,
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to process payment", error });
        }
    }
    async generateInvoicePDF(req, res) {
        try {
            const { id } = req.params;
            const invoice = await prisma_1.prisma.invoice.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true, totalAmount: true } }
                }
            });
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }
            const user = req.user;
            if (user.role === "customer" && invoice.customerId !== (user.id || user._id?.toString())) {
                return res.status(403).json({ message: "Access denied" });
            }
            res.json({
                message: "PDF generation not implemented yet",
                invoice
            });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to generate PDF", error });
        }
    }
    async getDraftInvoices(req, res) {
        try {
            const invoices = await prisma_1.prisma.invoice.findMany({
                where: { status: "draft" },
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true } }
                }
            });
            res.json(invoices);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch draft invoices", error });
        }
    }
    async getSentInvoices(req, res) {
        try {
            const user = req.user;
            let filter = { status: "sent" };
            if (user.role === "customer") {
                filter.customerId = user.id || user._id?.toString();
            }
            const invoices = await prisma_1.prisma.invoice.findMany({
                where: filter,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true } }
                }
            });
            res.json(invoices);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch sent invoices", error });
        }
    }
    async getPaidInvoices(req, res) {
        try {
            const user = req.user;
            let filter = { status: "paid" };
            if (user.role === "customer") {
                filter.customerId = user.id || user._id?.toString();
            }
            const invoices = await prisma_1.prisma.invoice.findMany({
                where: filter,
                orderBy: { paidAt: 'desc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true } }
                }
            });
            res.json(invoices);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch paid invoices", error });
        }
    }
    async getOverdueInvoices(req, res) {
        try {
            const user = req.user;
            let filter = { status: "overdue" };
            if (user.role === "customer") {
                filter.customerId = user.id || user._id?.toString();
            }
            const invoices = await prisma_1.prisma.invoice.findMany({
                where: filter,
                orderBy: { dueDate: 'asc' },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    booking: { select: { warehouseId: true } }
                }
            });
            res.json(invoices);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch overdue invoices", error });
        }
    }
    async generateInvoiceNumber() {
        const prefix = "INV";
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const startOfMonth = new Date(year, new Date().getMonth(), 1);
        const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
        const count = await prisma_1.prisma.invoice.count({
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
exports.InvoiceController = InvoiceController;
exports.invoiceController = new InvoiceController();
//# sourceMappingURL=invoiceController.js.map