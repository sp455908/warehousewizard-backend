import { warehouseService } from "./warehouseService";
import { notificationService } from "./notificationService";
import { cacheService } from "./cacheService";
import { prisma } from "../config/prisma";
import { QuoteStatus } from "@prisma/client";

export interface QuoteFilters {
  customerId?: string;
  status?: QuoteStatus;
  assignedTo?: string;
  warehouseId?: string;
  storageType?: string;
}

export class QuoteService {
  async createQuote(quoteData: any) {
    const savedQuote = await prisma.quote.create({
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
    
    // Invalidate user quotes cache
    await cacheService.invalidateUserQuotes(quoteData.customerId);
    
    // Send notification to customer
    // Note: You'll need to get customer email from user service
    // await notificationService.sendQuoteRequestNotification(customerEmail, savedQuote._id.toString());
    
    return savedQuote;
  }

  async getQuoteById(id: string) {
    return await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
        assignedToUser: { select: { firstName: true, lastName: true, email: true, id: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
      },
    });
  }

  async getQuotesByCustomer(customerId: string) {
    // Try cache first
    const cached = await cacheService.getUserQuotes(customerId);
    if (cached) {
      return cached;
    }

    const quotes = await prisma.quote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { select: { name: true, location: true, city: true, state: true, id: true } } },
    });
    
    // Cache the results
    await cacheService.setUserQuotes(customerId, quotes);
    
    return quotes;
  }

  async getQuotesByStatus(status: QuoteStatus) {
    return await prisma.quote.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
        assignedToUser: { select: { firstName: true, lastName: true, email: true, id: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
      },
    });
  }

  async getQuotesByAssignee(assignedTo: string) {
    return await prisma.quote.findMany({
      where: { assignedTo },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true, id: true } },
      },
    });
  }

  async updateQuote(id: string, updateData: any) {
    const quote = await prisma.quote.update({ where: { id }, data: updateData });
    
    if (quote) {
      // Invalidate user quotes cache
      await cacheService.invalidateUserQuotes(quote.customerId);
    }
    
    return quote;
  }

  async assignQuote(id: string, assignedTo: string) {
    const quote = await this.updateQuote(id, {
      assignedTo: assignedTo,
      status: "processing"
    });
    
    return quote;
  }

  async approveQuote(id: string, finalPrice: number, warehouseId?: string) {
    const updateData: any = {
      status: "quoted",
      finalPrice
    };
    
    if (warehouseId) {
      updateData.warehouseId = warehouseId;
    }
    
    const quote = await this.updateQuote(id, updateData);
    
    if (quote) {
      // Send approval notification
      // await notificationService.sendQuoteApprovalNotification(
      //   quote.customerId.email,
      //   quote._id.toString(),
      //   finalPrice
      // );
    }
    
    return quote;
  }

  async rejectQuote(id: string, reason?: string) {
    return await this.updateQuote(id, {
      status: "rejected",
      specialRequirements: reason ? `Rejected: ${reason}` : "Rejected"
    });
  }

  async getQuotesForWarehouse(warehouseId: string) {
    return await prisma.quote.findMany({
      where: { warehouseId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { firstName: true, lastName: true, email: true, company: true, id: true } } },
    });
  }

  // Advanced filtering and search
  async searchQuotes(filters: QuoteFilters & {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      customerId,
      status,
      assignedTo,
      warehouseId,
      storageType,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (warehouseId) where.warehouseId = warehouseId;
    if (storageType) where.storageType = { contains: storageType, mode: 'insensitive' };

    const orderBy: any = { [sortBy]: sortOrder };
    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
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
      prisma.quote.count({ where })
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

  // Get quotes requiring action by role
  async getQuotesForRole(role: string, userId?: string) {
    switch (role) {
      case 'purchase_support':
        return await this.getQuotesByStatus(QuoteStatus.pending);
      
      case 'sales_support':
        return await this.getQuotesByStatus(QuoteStatus.processing);
      
      case 'warehouse':
        // Get quotes assigned to this warehouse user
        if (userId) {
          return await this.getQuotesByAssignee(userId);
        }
        return [];
      
      case 'supervisor':
        return await this.getQuotesByStatus(QuoteStatus.quoted);
      
      default:
        return [];
    }
  }

  // Calculate quote pricing based on warehouse and requirements
  async calculateQuotePrice(quoteId: string): Promise<number | null> {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || !quote.warehouseId) {
      return null;
    }

    const warehouse = await warehouseService.getWarehouseById(quote.warehouseId);
    if (!warehouse) {
      return null;
    }

    // Basic calculation: space * price per sq ft * duration multiplier
    const basePrice = quote.requiredSpace * warehouse.pricePerSqFt;
    
    // Duration multiplier (simplified)
    let durationMultiplier = 1;
    if (quote.duration.includes('month')) {
      const months = parseInt(quote.duration);
      durationMultiplier = months || 1;
    } else if (quote.duration.includes('year')) {
      const years = parseInt(quote.duration);
      durationMultiplier = (years || 1) * 12;
    }

    // Storage type multiplier
    const storageTypeMultipliers: { [key: string]: number } = {
      'cold_storage': 1.5,
      'hazmat': 2.0,
      'climate_controlled': 1.3,
      'dry_storage': 1.0
    };

    const storageMultiplier = storageTypeMultipliers[warehouse.storageType] || 1.0;

    return Math.round(basePrice * durationMultiplier * storageMultiplier);
  }
}

export const quoteService = new QuoteService();