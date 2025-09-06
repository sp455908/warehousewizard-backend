"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteController = exports.QuoteController = void 0;
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const insertQuoteSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    storageType: zod_1.z.string(),
    requiredSpace: zod_1.z.number(),
    preferredLocation: zod_1.z.string(),
    duration: zod_1.z.string(),
    specialRequirements: zod_1.z.string().optional(),
});
const quoteSearchSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    storageType: zod_1.z.string().optional(),
    page: zod_1.z.preprocess(val => parseInt(val, 10), zod_1.z.number().default(1)),
    limit: zod_1.z.preprocess(val => parseInt(val, 10), zod_1.z.number().default(20)),
    sortBy: zod_1.z.string().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
class QuoteController {
    async createQuote(req, res) {
        try {
            const quoteData = insertQuoteSchema.parse({
                ...req.body,
                customerId: req.user.id || req.user._id?.toString(),
            });
            const quote = await prisma_1.prisma.quote.create({
                data: {
                    customerId: quoteData.customerId,
                    storageType: quoteData.storageType,
                    requiredSpace: quoteData.requiredSpace,
                    preferredLocation: quoteData.preferredLocation,
                    duration: quoteData.duration,
                    specialRequirements: quoteData.specialRequirements,
                    status: "pending",
                },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } }
                }
            });
            res.status(201).json(quote);
            return;
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: "Invalid quote data", errors: error.issues });
            }
            return res.status(500).json({ message: "Failed to create quote", error });
        }
    }
    async getQuotes(req, res) {
        try {
            const user = req.user;
            let quotes;
            if (user.role === "customer") {
                quotes = await this.getQuotesByCustomer(user.id || user._id?.toString());
            }
            else if (user.role === "purchase_support") {
                quotes = await this.getQuotesByStatus(client_1.QuoteStatus.pending);
            }
            else if (user.role === "sales_support") {
                quotes = await this.getQuotesByStatus(client_1.QuoteStatus.processing);
            }
            else if (user.role === "warehouse") {
                quotes = await this.getQuotesByAssignee(user.id || user._id?.toString());
            }
            else {
                const searchParams = quoteSearchSchema.parse(req.query);
                const result = await this.searchQuotes(searchParams);
                return res.json(result);
            }
            res.json(quotes);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch quotes", error });
        }
    }
    async getQuoteById(req, res) {
        try {
            const { id } = req.params;
            const quote = await prisma_1.prisma.quote.findUnique({
                where: { id },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true } },
                    assignedToUser: { select: { firstName: true, lastName: true, email: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            const user = req.user;
            if (user.role === "customer" && quote.customerId !== (user.id || user._id?.toString())) {
                return res.status(403).json({ message: "Access denied" });
            }
            res.json(quote);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch quote", error });
        }
    }
    async updateQuote(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const quote = await prisma_1.prisma.quote.update({
                where: { id },
                data: { ...updateData, updatedAt: new Date() },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true } },
                    assignedToUser: { select: { firstName: true, lastName: true, email: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            res.json(quote);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update quote", error });
        }
    }
    async assignQuote(req, res) {
        try {
            const { id } = req.params;
            const { assignedTo } = req.body;
            if (req.user.role !== "purchase_support") {
                return res.status(403).json({ message: "Insufficient permissions" });
            }
            const quote = await prisma_1.prisma.quote.update({
                where: { id },
                data: {
                    assignedTo,
                    status: "processing",
                    updatedAt: new Date()
                },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    assignedToUser: { select: { firstName: true, lastName: true, email: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            res.json(quote);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to assign quote", error });
        }
    }
    async approveQuote(req, res) {
        try {
            const { id } = req.params;
            const { finalPrice, warehouseId } = req.body;
            if (!["sales_support", "supervisor"].includes(req.user.role)) {
                return res.status(403).json({ message: "Insufficient permissions" });
            }
            const quote = await prisma_1.prisma.quote.update({
                where: { id },
                data: {
                    status: "quoted",
                    finalPrice,
                    warehouseId,
                    updatedAt: new Date()
                },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            res.json(quote);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to approve quote", error });
        }
    }
    async rejectQuote(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const quote = await prisma_1.prisma.quote.update({
                where: { id },
                data: {
                    status: "rejected",
                    specialRequirements: reason ? `Rejected: ${reason}` : "Rejected",
                    updatedAt: new Date()
                },
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            res.json(quote);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to reject quote", error });
        }
    }
    async getQuotesForRole(req, res) {
        try {
            const user = req.user;
            const quotes = await this.getQuotesForRoleInternal(user.role, user.id || user._id?.toString());
            res.json(quotes);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch quotes for role", error });
        }
    }
    async calculateQuotePrice(req, res) {
        try {
            const { id } = req.params;
            const quote = await prisma_1.prisma.quote.findUnique({
                where: { id },
                include: {
                    warehouse: { select: { pricePerSqFt: true } }
                }
            });
            if (!quote) {
                return res.status(404).json({ message: "Quote not found" });
            }
            const basePrice = quote.requiredSpace * (quote.warehouse?.pricePerSqFt || 10);
            const durationMonths = parseInt(quote.duration) || 1;
            const estimatedPrice = basePrice * durationMonths;
            res.json({ estimatedPrice });
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to calculate quote price", error });
        }
    }
    async getPendingQuotes(req, res) {
        try {
            const quotes = await this.getQuotesByStatus(client_1.QuoteStatus.pending);
            res.json(quotes);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch pending quotes", error });
        }
    }
    async getProcessingQuotes(req, res) {
        try {
            const quotes = await this.getQuotesByStatus(client_1.QuoteStatus.processing);
            res.json(quotes);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch processing quotes", error });
        }
    }
    async getQuotedQuotes(req, res) {
        try {
            const quotes = await this.getQuotesByStatus(client_1.QuoteStatus.quoted);
            res.json(quotes);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch quoted quotes", error });
        }
    }
    async getQuotesByCustomer(customerId) {
        return await prisma_1.prisma.quote.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true } },
                assignedToUser: { select: { firstName: true, lastName: true, email: true } }
            }
        });
    }
    async getQuotesByStatus(status) {
        return await prisma_1.prisma.quote.findMany({
            where: { status },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true } },
                assignedToUser: { select: { firstName: true, lastName: true, email: true } }
            }
        });
    }
    async getQuotesByAssignee(assignedTo) {
        return await prisma_1.prisma.quote.findMany({
            where: { assignedTo },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true } },
                assignedToUser: { select: { firstName: true, lastName: true, email: true } }
            }
        });
    }
    async getQuotesForRoleInternal(role, userId) {
        switch (role) {
            case "customer":
                return await this.getQuotesByCustomer(userId);
            case "purchase_support":
                return await this.getQuotesByStatus(client_1.QuoteStatus.pending);
            case "sales_support":
                return await this.getQuotesByStatus(client_1.QuoteStatus.processing);
            case "warehouse":
                return await this.getQuotesByAssignee(userId);
            default:
                return await prisma_1.prisma.quote.findMany({
                    orderBy: { createdAt: 'desc' },
                    include: {
                        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                        warehouse: { select: { name: true, location: true, city: true, state: true } },
                        assignedToUser: { select: { firstName: true, lastName: true, email: true } }
                    }
                });
        }
    }
    async searchQuotes(params) {
        const { status, storageType, page, limit, sortBy, sortOrder } = params;
        const where = {};
        if (status)
            where.status = status;
        if (storageType)
            where.storageType = storageType;
        const skip = (page - 1) * limit;
        const [quotes, total] = await Promise.all([
            prisma_1.prisma.quote.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit,
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true } },
                    assignedToUser: { select: { firstName: true, lastName: true, email: true } }
                }
            }),
            prisma_1.prisma.quote.count({ where })
        ]);
        return {
            quotes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
}
exports.QuoteController = QuoteController;
exports.quoteController = new QuoteController();
//# sourceMappingURL=quoteController.js.map