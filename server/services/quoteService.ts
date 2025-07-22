import { QuoteModel, type Quote, type InsertQuote } from "@shared/schema";
import { warehouseService } from "./warehouseService";
import { notificationService } from "./notificationService";
import { cacheService } from "./cacheService";

export interface QuoteFilters {
  customerId?: string;
  status?: string;
  assignedTo?: string;
  warehouseId?: string;
  storageType?: string;
}

export class QuoteService {
  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const quote = new QuoteModel(quoteData);
    const savedQuote = await quote.save();
    
    // Invalidate user quotes cache
    await cacheService.invalidateUserQuotes(quoteData.customerId);
    
    // Send notification to customer
    // Note: You'll need to get customer email from user service
    // await notificationService.sendQuoteRequestNotification(customerEmail, savedQuote._id.toString());
    
    return savedQuote;
  }

  async getQuoteById(id: string): Promise<Quote | null> {
    return await QuoteModel.findById(id)
      .populate('customerId', 'firstName lastName email company')
      .populate('assignedTo', 'firstName lastName email')
      .populate('warehouseId', 'name location city state');
  }

  async getQuotesByCustomer(customerId: string): Promise<Quote[]> {
    // Try cache first
    const cached = await cacheService.getUserQuotes(customerId);
    if (cached) {
      return cached;
    }

    const quotes = await QuoteModel.find({ customerId })
      .populate('warehouseId', 'name location city state')
      .sort({ createdAt: -1 });
    
    // Cache the results
    await cacheService.setUserQuotes(customerId, quotes);
    
    return quotes;
  }

  async getQuotesByStatus(status: string): Promise<Quote[]> {
    return await QuoteModel.find({ status })
      .populate('customerId', 'firstName lastName email company')
      .populate('assignedTo', 'firstName lastName email')
      .populate('warehouseId', 'name location city state')
      .sort({ createdAt: -1 });
  }

  async getQuotesByAssignee(assignedTo: string): Promise<Quote[]> {
    return await QuoteModel.find({ assignedTo })
      .populate('customerId', 'firstName lastName email company')
      .populate('warehouseId', 'name location city state')
      .sort({ createdAt: -1 });
  }

  async updateQuote(id: string, updateData: Partial<Quote>): Promise<Quote | null> {
    const quote = await QuoteModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('customerId', 'firstName lastName email company');
    
    if (quote) {
      // Invalidate user quotes cache
      await cacheService.invalidateUserQuotes(quote.customerId._id.toString());
    }
    
    return quote;
  }

  async assignQuote(id: string, assignedTo: string): Promise<Quote | null> {
    const quote = await this.updateQuote(id, {
      assignedTo: assignedTo as any,
      status: "processing"
    });
    
    return quote;
  }

  async approveQuote(id: string, finalPrice: number, warehouseId?: string): Promise<Quote | null> {
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

  async rejectQuote(id: string, reason?: string): Promise<Quote | null> {
    return await this.updateQuote(id, {
      status: "rejected",
      specialRequirements: reason ? `Rejected: ${reason}` : "Rejected"
    });
  }

  async getQuotesForWarehouse(warehouseId: string): Promise<Quote[]> {
    return await QuoteModel.find({ warehouseId })
      .populate('customerId', 'firstName lastName email company')
      .sort({ createdAt: -1 });
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

    const filter: any = {};

    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (warehouseId) filter.warehouseId = warehouseId;
    if (storageType) filter.storageType = new RegExp(storageType, 'i');

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      QuoteModel.find(filter)
        .populate('customerId', 'firstName lastName email company')
        .populate('assignedTo', 'firstName lastName email')
        .populate('warehouseId', 'name location city state')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      QuoteModel.countDocuments(filter)
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
        return await this.getQuotesByStatus('pending');
      
      case 'sales_support':
        return await this.getQuotesByStatus('processing');
      
      case 'warehouse':
        // Get quotes assigned to this warehouse user
        if (userId) {
          return await this.getQuotesByAssignee(userId);
        }
        return [];
      
      case 'supervisor':
        return await this.getQuotesByStatus('quoted');
      
      default:
        return [];
    }
  }

  // Calculate quote pricing based on warehouse and requirements
  async calculateQuotePrice(quoteId: string): Promise<number | null> {
    const quote = await this.getQuoteById(quoteId);
    if (!quote || !quote.warehouseId) {
      return null;
    }

    const warehouse = await warehouseService.getWarehouseById(quote.warehouseId._id.toString());
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