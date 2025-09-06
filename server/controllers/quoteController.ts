import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { QuoteStatus } from "@prisma/client";
import { z } from "zod";


const insertQuoteSchema = z.object({
  customerId: z.string(),
  storageType: z.string(),
  requiredSpace: z.number(),
  preferredLocation: z.string(),
  duration: z.string(),
  specialRequirements: z.string().optional(),
});

const quoteSearchSchema = z.object({
  status: z.string().optional(),
  storageType: z.string().optional(),
  page: z.preprocess(val => parseInt(val as string, 10), z.number().default(1)),
  limit: z.preprocess(val => parseInt(val as string, 10), z.number().default(20)),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class QuoteController {
  async createQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const quoteData = insertQuoteSchema.parse({
        ...req.body,
        customerId: (req.user! as any).id || (req.user! as any)._id?.toString(),
      });
      
      const quote = await prisma.quote.create({
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid quote data", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to create quote", error });
    }
  }

  async getQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let quotes;

      if (user.role === "customer") {
        quotes = await this.getQuotesByCustomer(user.id || user._id?.toString());
      } else if (user.role === "purchase_support") {
        quotes = await this.getQuotesByStatus(QuoteStatus.pending);
      } else if (user.role === "sales_support") {
        quotes = await this.getQuotesByStatus(QuoteStatus.processing);
      } else if (user.role === "warehouse") {
        quotes = await this.getQuotesByAssignee(user.id || user._id?.toString());
      } else {
        // Admin, supervisor can see all
        const searchParams = quoteSearchSchema.parse(req.query);
        const result = await this.searchQuotes(searchParams);
        return res.json(result);
      }

      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quotes", error });
    }
  }

  async getQuoteById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await prisma.quote.findUnique({
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

      // Check permissions
      const user = req.user! as any;
      if (user.role === "customer" && quote.customerId !== (user.id || user._id?.toString())) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(quote);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quote", error });
    }
  }

  async updateQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const quote = await prisma.quote.update({
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to update quote", error });
    }
  }

  async assignQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      
      // Only purchase support can assign quotes
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.update({
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign quote", error });
    }
  }

  async approveQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { finalPrice, warehouseId } = req.body;
      
      // Only sales support and supervisors can approve quotes
      if (!["sales_support", "supervisor"].includes((req.user! as any).role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.update({
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to approve quote", error });
    }
  }

  async rejectQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const quote = await prisma.quote.update({
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
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject quote", error });
    }
  }

  async getQuotesForRole(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const quotes = await this.getQuotesForRoleInternal(user.role, user.id || user._id?.toString());
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quotes for role", error });
    }
  }

  async calculateQuotePrice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      // Get quote details
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: {
          warehouse: { select: { pricePerSqFt: true } }
        }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Simple price calculation based on space and duration
      const basePrice = quote.requiredSpace * (quote.warehouse?.pricePerSqFt || 10);
      const durationMonths = parseInt(quote.duration) || 1;
      const estimatedPrice = basePrice * durationMonths;
      
      res.json({ estimatedPrice });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to calculate quote price", error });
    }
  }

  // Get quotes by status for different roles
  async getPendingQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await this.getQuotesByStatus(QuoteStatus.pending);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending quotes", error });
    }
  }

  async getProcessingQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await this.getQuotesByStatus(QuoteStatus.processing);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch processing quotes", error });
    }
  }

  async getQuotedQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await this.getQuotesByStatus(QuoteStatus.quoted);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quoted quotes", error });
    }
  }

  // Helper methods for internal use
  private async getQuotesByCustomer(customerId: string) {
    return await prisma.quote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true } },
        assignedToUser: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  private async getQuotesByStatus(status: QuoteStatus) {
    return await prisma.quote.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true } },
        assignedToUser: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  private async getQuotesByAssignee(assignedTo: string) {
    return await prisma.quote.findMany({
      where: { assignedTo },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
        warehouse: { select: { name: true, location: true, city: true, state: true } },
        assignedToUser: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  private async getQuotesForRoleInternal(role: string, userId: string) {
    switch (role) {
      case "customer":
        return await this.getQuotesByCustomer(userId);
      case "purchase_support":
        return await this.getQuotesByStatus(QuoteStatus.pending);
      case "sales_support":
        return await this.getQuotesByStatus(QuoteStatus.processing);
      case "warehouse":
        return await this.getQuotesByAssignee(userId);
      default:
        return await prisma.quote.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
    }
  }

  private async searchQuotes(params: any) {
    const { status, storageType, page, limit, sortBy, sortOrder } = params;
    
    const where: any = {};
    if (status) where.status = status;
    if (storageType) where.storageType = storageType;
    
    const skip = (page - 1) * limit;
    
    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
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
}

export const quoteController = new QuoteController();