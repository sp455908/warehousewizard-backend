"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteService = exports.QuoteService = void 0;
const warehouseService_1 = require("./warehouseService");
const cacheService_1 = require("./cacheService");
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
class QuoteService {
    async createQuote(quoteData) {
        const savedQuote = await prisma_1.prisma.quote.create({
            data: {
                customerId: quoteData.customerId,
                storageType: quoteData.storageType,
                requiredSpace: quoteData.requiredSpace,
                preferredLocation: quoteData.preferredLocation,
                duration: quoteData.duration,
                specialRequirements: quoteData.specialRequirements,
                status: 'pending',
                assignedTo: quoteData.assignedTo || null,
                finalPrice: quoteData.finalPrice ?? null,
                warehouseId: quoteData.warehouseId || null,
            },
        });
        await cacheService_1.cacheService.invalidateUserQuotes(quoteData.customerId);
        return savedQuote;
    }
    async getQuoteById(id) {
        return await prisma_1.prisma.quote.findUnique({
            where: { id },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                assignedToUser: { select: { firstName: true, lastName: true, email: true, id: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
            },
        });
    }
    async getQuotesByCustomer(customerId) {
        const cached = await cacheService_1.cacheService.getUserQuotes(customerId);
        if (cached) {
            return cached;
        }
        const quotes = await prisma_1.prisma.quote.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: { warehouse: { select: { name: true, location: true, city: true, state: true, id: true } } },
        });
        await cacheService_1.cacheService.setUserQuotes(customerId, quotes);
        return quotes;
    }
    async getQuotesByStatus(status) {
        return await prisma_1.prisma.quote.findMany({
            where: { status },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                assignedToUser: { select: { firstName: true, lastName: true, email: true, id: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
            },
        });
    }
    async getQuotesByAssignee(assignedTo) {
        return await prisma_1.prisma.quote.findMany({
            where: { assignedTo },
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
            },
        });
    }
    async updateQuote(id, updateData) {
        const quote = await prisma_1.prisma.quote.update({ where: { id }, data: updateData });
        if (quote) {
            await cacheService_1.cacheService.invalidateUserQuotes(quote.customerId);
        }
        return quote;
    }
    async assignQuote(id, assignedTo) {
        const quote = await this.updateQuote(id, {
            assignedTo: assignedTo,
            status: "processing"
        });
        return quote;
    }
    async approveQuote(id, finalPrice, warehouseId) {
        const updateData = {
            status: "quoted",
            finalPrice
        };
        if (warehouseId) {
            updateData.warehouseId = warehouseId;
        }
        const quote = await this.updateQuote(id, updateData);
        if (quote) {
        }
        return quote;
    }
    async rejectQuote(id, reason) {
        return await this.updateQuote(id, {
            status: "rejected",
            specialRequirements: reason ? `Rejected: ${reason}` : "Rejected"
        });
    }
    async getQuotesForWarehouse(warehouseId) {
        return await prisma_1.prisma.quote.findMany({
            where: { warehouseId },
            orderBy: { createdAt: 'desc' },
            include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } },
        });
    }
    async searchQuotes(filters) {
        const { customerId, status, assignedTo, warehouseId, storageType, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
        const where = {};
        if (customerId)
            where.customerId = customerId;
        if (status)
            where.status = status;
        if (assignedTo)
            where.assignedTo = assignedTo;
        if (warehouseId)
            where.warehouseId = warehouseId;
        if (storageType)
            where.storageType = { contains: storageType, mode: 'insensitive' };
        const orderBy = { [sortBy]: sortOrder };
        const skip = (page - 1) * limit;
        const [quotes, total] = await Promise.all([
            prisma_1.prisma.quote.findMany({
                where,
                include: {
                    customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
                    assignedToUser: { select: { firstName: true, lastName: true, email: true, id: true } },
                    warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
                },
                orderBy,
                skip,
                take: limit,
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
    async getQuotesForRole(role, userId) {
        switch (role) {
            case 'purchase_support':
                return await this.getQuotesByStatus(client_1.QuoteStatus.pending);
            case 'sales_support':
                return await this.getQuotesByStatus(client_1.QuoteStatus.processing);
            case 'warehouse':
                if (userId) {
                    return await this.getQuotesByAssignee(userId);
                }
                return [];
            case 'supervisor':
                return await this.getQuotesByStatus(client_1.QuoteStatus.quoted);
            default:
                return [];
        }
    }
    async calculateQuotePrice(quoteId) {
        const quote = await prisma_1.prisma.quote.findUnique({ where: { id: quoteId } });
        if (!quote || !quote.warehouseId) {
            return null;
        }
        const warehouse = await warehouseService_1.warehouseService.getWarehouseById(quote.warehouseId);
        if (!warehouse) {
            return null;
        }
        const basePrice = quote.requiredSpace * warehouse.pricePerSqFt;
        let durationMultiplier = 1;
        if (quote.duration.includes('month')) {
            const months = parseInt(quote.duration);
            durationMultiplier = months || 1;
        }
        else if (quote.duration.includes('year')) {
            const years = parseInt(quote.duration);
            durationMultiplier = (years || 1) * 12;
        }
        const storageTypeMultipliers = {
            'cold_storage': 1.5,
            'hazmat': 2.0,
            'climate_controlled': 1.3,
            'dry_storage': 1.0
        };
        const storageMultiplier = storageTypeMultipliers[warehouse.storageType] || 1.0;
        return Math.round(basePrice * durationMultiplier * storageMultiplier);
    }
}
exports.QuoteService = QuoteService;
exports.quoteService = new QuoteService();
//# sourceMappingURL=quoteService.js.map