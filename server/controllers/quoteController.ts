import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { QuoteStatus } from "@prisma/client";
import { z } from "zod";
import { notificationService } from "../services/notificationService";


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
  createQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = (req.user! as any).id;
      
      // Handle specialized forms differently
      if (req.body.formType) {
        // For specialized forms, store the entire form data as JSON
        const quote = await prisma.quote.create({
          data: {
            customerId: customerId,
            storageType: req.body.formType, // Use formType as storageType
            requiredSpace: req.body.spaceRequired || req.body.requiredSpace || 0,
            preferredLocation: req.body.origin || req.body.preferredLocation || "Not specified",
            duration: req.body.storagePeriod ? `${req.body.storagePeriod} days` : "Not specified",
            specialRequirements: JSON.stringify(req.body), // Store entire form data as JSON
            status: "pending",
            warehouseId: req.body.warehouseId || null,
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } }
          }
        });

        res.status(201).json(quote);
        return;
      }
      
      // Handle basic forms (original logic)
      const quoteData = insertQuoteSchema.parse({
        ...req.body,
        customerId: customerId,
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

  getQuotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user! as any;
      console.log("[DEBUG] getQuotes - User:", user);
      console.log("[DEBUG] getQuotes - User ID:", user.id);
      console.log("[DEBUG] getQuotes - User Role:", user.role);
      
      let quotes;

      if (user.role === "customer") {
        const customerId = user.id;
        console.log("[DEBUG] getQuotes - Customer ID:", customerId);
        if (!customerId) {
          return res.status(400).json({ message: "Customer ID not found" });
        }
        quotes = await QuoteController.getQuotesByCustomer(customerId);
      } else if (user.role === "purchase_support") {
        quotes = await QuoteController.getQuotesByStatus(QuoteStatus.pending);
      } else if (user.role === "sales_support") {
        quotes = await QuoteController.getQuotesByStatus(QuoteStatus.processing);
      } else if (user.role === "warehouse") {
        quotes = await QuoteController.getQuotesByAssignee(user.id);
      } else {
        // Admin, supervisor can see all
        const searchParams = quoteSearchSchema.parse(req.query);
        const result = await QuoteController.searchQuotes(searchParams);
        return res.json(result);
      }

      res.json(quotes);
      return;
    } catch (error) {
      console.error("[DEBUG] getQuotes - Error:", error);
      return res.status(500).json({ 
        message: "Failed to fetch quotes", 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  getQuoteById = async (req: AuthenticatedRequest, res: Response) => {
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
      if (user.role === "customer" && quote.customerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(quote);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quote", error });
    }
  }

  updateQuote = async (req: AuthenticatedRequest, res: Response) => {
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

  assignQuote = async (req: AuthenticatedRequest, res: Response) => {
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

  // New method to handle customer confirmation
  confirmQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { confirmed } = req.body;
      
      // Only customer can confirm quotes
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check if quote belongs to this customer
      if (quote.customerId !== (req.user! as any).id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (confirmed) {
        // Customer confirmed - create booking
        const booking = await prisma.booking.create({
          data: {
            quoteId: id,
            customerId: quote.customerId,
            warehouseId: quote.warehouseId!,
            status: "customer_confirmation_pending",
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            totalAmount: quote.finalPrice || 0,
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true } },
            warehouse: { select: { name: true, location: true } }
          }
        });
        
        // Update quote status
        await prisma.quote.update({
          where: { id },
          data: { status: "customer_confirmation_pending" }
        });
        
        res.json({ message: "Quote confirmed and booking created", booking });
      } else {
        // Customer rejected
        await prisma.quote.update({
          where: { id },
          data: { status: "rejected" }
        });
        
        res.json({ message: "Quote rejected" });
      }
      
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to confirm quote", error });
    }
  }

  approveQuote = async (req: AuthenticatedRequest, res: Response) => {
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

  rejectQuote = async (req: AuthenticatedRequest, res: Response) => {
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

  // Customer quote confirmation (agree/reject rate)
  confirmQuoteByCustomer = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { confirmed, bookingData } = req.body;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      // Verify customer owns this quote
      const quote = await prisma.quote.findFirst({
        where: { id, customerId }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      if (confirmed) {
        // Customer agrees with rate - set status to customer_confirmation_pending
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { 
            status: "customer_confirmation_pending",
            updatedAt: new Date()
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } }
          }
        });
        
        // If booking data provided, create booking
        if (bookingData) {
          const booking = await prisma.booking.create({
            data: {
              quoteId: id,
              customerId,
              warehouseId: quote.warehouseId!,
              status: "customer_confirmation_pending",
              startDate: new Date(bookingData.startDate),
              endDate: new Date(bookingData.endDate),
              totalAmount: quote.finalPrice || 0,
            },
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          });
          
          return res.json({ quote: updatedQuote, booking });
        }
        
        return res.json({ quote: updatedQuote });
      } else {
        // Customer rejects rate
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { 
            status: "rejected",
            specialRequirements: "Rejected by customer",
            updatedAt: new Date()
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } }
          }
        });
        
        return res.json({ quote: updatedQuote });
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to confirm quote", error });
    }
  }

  // Sales rate editing with margin
  editQuoteRate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { finalPrice, margin, notes } = req.body;
      
      // Only sales support can edit rates
      if ((req.user! as any).role !== "sales_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          finalPrice,
          specialRequirements: notes ? `Sales notes: ${notes}` : quote.specialRequirements,
          status: "quoted",
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
      return res.status(500).json({ message: "Failed to edit quote rate", error });
    }
  }

  getQuotesForRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user! as any;
      const quotes = await QuoteController.getQuotesForRoleInternal(user.role, user.id);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quotes for role", error });
    }
  }

  calculateQuotePrice = async (req: AuthenticatedRequest, res: Response) => {
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
  getPendingQuotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const quotes = await QuoteController.getQuotesByStatus(QuoteStatus.pending);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending quotes", error });
    }
  }

  getProcessingQuotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const quotes = await QuoteController.getQuotesByStatus(QuoteStatus.processing);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch processing quotes", error });
    }
  }

  getQuotedQuotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const quotes = await QuoteController.getQuotesByStatus(QuoteStatus.quoted);
      res.json(quotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quoted quotes", error });
    }
  }

  // Helper methods for internal use
  private static async getQuotesByCustomer(customerId: string) {
    console.log("[DEBUG] getQuotesByCustomer - Customer ID:", customerId);
    try {
      const quotes = await prisma.quote.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          storageType: true,
          requiredSpace: true,
          preferredLocation: true,
          duration: true,
          specialRequirements: true,
          status: true,
          assignedTo: true,
          warehouseId: true,
          createdAt: true,
          updatedAt: true,
          // Exclude finalPrice for customers
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        }
      });
      console.log("[DEBUG] getQuotesByCustomer - Found quotes:", quotes.length);
      return quotes;
    } catch (error) {
      console.error("[DEBUG] getQuotesByCustomer - Error:", error);
      throw error;
    }
  }

  private static async getQuotesByStatus(status: QuoteStatus) {
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

  private static async getQuotesByAssignee(assignedTo: string) {
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

  private static async getQuotesForRoleInternal(role: string, userId: string) {
    switch (role) {
      case "customer":
        return await QuoteController.getQuotesByCustomer(userId);
      case "purchase_support":
        return await QuoteController.getQuotesByStatus(QuoteStatus.pending);
      case "sales_support":
        return await QuoteController.getQuotesByStatus(QuoteStatus.processing);
      case "warehouse":
        return await QuoteController.getQuotesByAssignee(userId);
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

  // Customer quote confirmation and booking form submission
  confirmQuoteByCustomer = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { action, bookingForm } = req.body; // action: 'agree' | 'reject', bookingForm: optional
      
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Check if customer owns this quote
      if (quote.customerId !== (req.user as any).id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (action === 'agree') {
        // Customer agrees with the rate
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { 
            status: "customer_confirmation_pending",
            specialRequirements: bookingForm ? JSON.stringify(bookingForm) : quote.specialRequirements
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } }
          }
        });

        // Send notification to supervisor
        await notificationService.sendEmail({
          to: "supervisor@example.com", // TODO: Get actual supervisor email
          subject: `Customer Quote Confirmation - Quote ${id}`,
          html: `
            <h2>Customer Quote Confirmation</h2>
            <p>Customer has agreed to the quote and submitted booking form.</p>
            <p>Quote ID: ${id}</p>
            <p>Customer: ${quote.customer.firstName} ${quote.customer.lastName}</p>
            <p>Please review and approve the booking request.</p>
          `,
        });

        res.json({ message: "Quote confirmed successfully", quote: updatedQuote });
      } else if (action === 'reject') {
        // Customer rejects the rate
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { status: "rejected" },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } }
          }
        });

        // Send notification to sales
        await notificationService.sendEmail({
          to: "sales@example.com", // TODO: Get actual sales email
          subject: `Customer Quote Rejection - Quote ${id}`,
          html: `
            <h2>Customer Quote Rejection</h2>
            <p>Customer has rejected the quote.</p>
            <p>Quote ID: ${id}</p>
            <p>Customer: ${quote.customer.firstName} ${quote.customer.lastName}</p>
            <p>Please review and adjust the pricing if needed.</p>
          `,
        });

        res.json({ message: "Quote rejected", quote: updatedQuote });
      } else {
        return res.status(400).json({ message: "Invalid action. Must be 'agree' or 'reject'" });
      }
    } catch (error) {
      console.error("Quote confirmation error:", error);
      return res.status(500).json({ message: "Failed to confirm quote", error });
    }
  };

  // Sales rate editing with margin
  editQuoteRate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { finalPrice, margin, notes } = req.body;
      
      // Only sales can edit rates
      if ((req.user! as any).role !== "sales_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          finalPrice,
          status: "quoted",
          specialRequirements: notes ? `Sales Notes: ${notes}` : undefined
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      // Send notification to customer
      await notificationService.sendEmail({
        to: quote.customer.email,
        subject: `Quote Updated - Quote ${id}`,
        html: `
          <h2>Quote Updated</h2>
          <p>Your quote has been updated with final pricing.</p>
          <p>Quote ID: ${id}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Please review and confirm your acceptance.</p>
        `,
      });

      res.json({ message: "Quote rate updated successfully", quote });
    } catch (error) {
      console.error("Quote rate edit error:", error);
      return res.status(500).json({ message: "Failed to edit quote rate", error });
    }
  };

  private static async searchQuotes(params: any) {
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

  // Purchase Panel: Accept/Reject warehouse quotes (A2-A3)
  acceptWarehouseQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { warehouseId, notes } = req.body;
      
      // Only purchase support can accept warehouse quotes
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true, warehouse: true }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Update quote with selected warehouse and status
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: {
          warehouseId: warehouseId || quote.warehouseId,
          status: "warehouse_selected",
          specialRequirements: notes ? `${quote.specialRequirements || ''}\nPurchase Notes: ${notes}` : quote.specialRequirements
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });
      
      // Send notification to sales support
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // This should be dynamic based on sales team
        subject: "Warehouse Quote Accepted - Ready for Sales Review",
        html: `
          <h2>Warehouse Quote Accepted</h2>
          <p>Quote ID: ${quote.id}</p>
          <p>Customer: ${quote.customer?.firstName} ${quote.customer?.lastName}</p>
          <p>Warehouse: ${updatedQuote.warehouse?.name}</p>
          <p>Status: Ready for sales review and rate finalization</p>
        `
      });
      
      res.json({ message: "Warehouse quote accepted", quote: updatedQuote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept warehouse quote", error });
    }
  }

  rejectWarehouseQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only purchase support can reject warehouse quotes
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Update quote status to rejected
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: {
          status: "rejected",
          specialRequirements: reason ? `${quote.specialRequirements || ''}\nRejection Reason: ${reason}` : quote.specialRequirements
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });
      
      // Send notification to customer
      await notificationService.sendEmail({
        to: quote.customer?.email || "",
        subject: "Quote Request Update - Warehouse Wizard",
        html: `
          <h2>Quote Request Update</h2>
          <p>Your quote request has been reviewed and unfortunately cannot be processed at this time.</p>
          <p>Quote ID: ${quote.id}</p>
          <p>Reason: ${reason || "No specific reason provided"}</p>
          <p>Please contact our support team for more information.</p>
        `
      });
      
      res.json({ message: "Warehouse quote rejected", quote: updatedQuote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject warehouse quote", error });
    }
  }

  // Purchase Panel: Assign warehouse to sales with rate forwarding (A9-A10)
  assignWarehouseToSales = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { salesUserId, notes, rateDetails } = req.body;
      
      // Only purchase support can assign to sales
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true, warehouse: true }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Update quote with sales assignment and rate details
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: {
          assignedTo: salesUserId,
          status: "assigned_to_sales",
          specialRequirements: rateDetails ? 
            `${quote.specialRequirements || ''}\nRate Details: ${JSON.stringify(rateDetails)}` : 
            quote.specialRequirements
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        }
      });
      
      // Send notification to sales support
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // This should be dynamic based on assigned user
        subject: "Quote Assigned for Sales Review",
        html: `
          <h2>Quote Assigned for Sales Review</h2>
          <p>Quote ID: ${quote.id}</p>
          <p>Customer: ${quote.customer?.firstName} ${quote.customer?.lastName}</p>
          <p>Warehouse: ${quote.warehouse?.name}</p>
          <p>Rate Details: ${rateDetails ? JSON.stringify(rateDetails) : 'To be determined'}</p>
          <p>Please review and finalize the rate for customer approval.</p>
        `
      });
      
      res.json({ message: "Quote assigned to sales", quote: updatedQuote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign quote to sales", error });
    }
  }

  // A5: Warehouse accepts quote request (A5)
  async warehouseAcceptQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { warehouseQuote, notes } = req.body;
      
      // Only warehouse can accept quotes
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          status: "warehouse_quote_accepted",
          warehouseQuote,
          warehouseNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to purchase team
      await notificationService.sendEmail({
        to: "purchase@warehousewizard.com", // TODO: Get actual purchase team email
        subject: `Warehouse Quote Accepted - Quote ${id}`,
        html: `
          <h2>Warehouse Quote Accepted</h2>
          <p>Warehouse has accepted the quote request.</p>
          <p>Quote ID: ${id}</p>
          <p>Warehouse Quote: $${warehouseQuote}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Notes: ${notes || 'None'}</p>
        `,
      });

      res.json({ message: "Warehouse quote accepted successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept warehouse quote", error });
    }
  }

  // A6: Warehouse rejects quote request (A6)
  async warehouseRejectQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only warehouse can reject quotes
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          status: "warehouse_quote_rejected",
          warehouseNotes: reason,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to purchase team
      await notificationService.sendEmail({
        to: "purchase@warehousewizard.com", // TODO: Get actual purchase team email
        subject: `Warehouse Quote Rejected - Quote ${id}`,
        html: `
          <h2>Warehouse Quote Rejected</h2>
          <p>Warehouse has rejected the quote request.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Rejection Reason: ${reason || 'No reason provided'}</p>
        `,
      });

      res.json({ message: "Warehouse quote rejected", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject warehouse quote", error });
    }
  }

  // A7: Warehouse updates price (A7)
  async warehouseUpdatePrice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { warehouseQuote, notes } = req.body;
      
      // Only warehouse can update prices
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          warehouseQuote,
          warehouseNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      res.json({ message: "Warehouse price updated successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update warehouse price", error });
    }
  }

  // A8: Warehouse sends request to purchase (A8)
  async warehouseRequestToPurchase(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { warehouseQuote, notes } = req.body;
      
      // Only warehouse can send requests to purchase
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          status: "warehouse_quote_requested",
          warehouseQuote,
          warehouseNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to purchase team
      await notificationService.sendEmail({
        to: "purchase@warehousewizard.com", // TODO: Get actual purchase team email
        subject: `Warehouse Quote Request - Quote ${id}`,
        html: `
          <h2>Warehouse Quote Request</h2>
          <p>Warehouse has sent a quote request to purchase team.</p>
          <p>Quote ID: ${id}</p>
          <p>Warehouse Quote: $${warehouseQuote}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Notes: ${notes || 'None'}</p>
        `,
      });

      res.json({ message: "Request sent to purchase team successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to send request to purchase", error });
    }
  }

  // A9: Purchase assigns warehouse by forwarding rate to sales (A9)
  async purchaseAssignToSales(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { salesUserId, notes } = req.body;
      
      // Only purchase support can assign to sales
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          assignedTo: salesUserId,
          status: "sales_assigned",
          purchaseNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to sales team
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // TODO: Get actual sales team email
        subject: `Quote Assigned to Sales - Quote ${id}`,
        html: `
          <h2>Quote Assigned to Sales Team</h2>
          <p>Purchase team has assigned this quote to sales for rate finalization.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Warehouse Quote: $${quote.warehouseQuote || 'To be determined'}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Notes: ${notes || 'None'}</p>
        `,
      });

      res.json({ message: "Quote assigned to sales team successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign quote to sales", error });
    }
  }

  // A10: Purchase assigns warehouse by forwarding rate to sales (A10)
  async purchaseAssignWarehouseToSales(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { warehouseId, salesUserId, notes } = req.body;
      
      // Only purchase support can assign warehouse to sales
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          warehouseId,
          assignedTo: salesUserId,
          status: "sales_assigned",
          purchaseNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to sales team
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // TODO: Get actual sales team email
        subject: `Warehouse Assigned to Sales - Quote ${id}`,
        html: `
          <h2>Warehouse Assigned to Sales Team</h2>
          <p>Purchase team has assigned a warehouse and forwarded the quote to sales.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Assigned Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Warehouse Location: ${(quote.warehouse as any).location}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Notes: ${notes || 'None'}</p>
        `,
      });

      res.json({ message: "Warehouse assigned to sales team successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign warehouse to sales", error });
    }
  }

  // A11: Sales edits rate and adds margin (A11)
  async salesEditRateAndAddMargin(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { salesMargin, salesPrice, notes } = req.body;
      
      // Only sales support can edit rates and add margins
      if ((req.user! as any).role !== "sales_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          salesMargin,
          salesPrice,
          salesNotes: notes,
          status: "rate_confirmed",
          finalPrice: salesPrice,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to customer
      await notificationService.sendEmail({
        to: (quote.customer as any).email,
        subject: `Quote Rate Confirmed - Quote ${id}`,
        html: `
          <h2>Quote Rate Confirmed</h2>
          <p>Your quote has been finalized and is ready for your approval.</p>
          <p>Quote ID: ${id}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Final Price: $${salesPrice}</p>
          <p>Sales Margin: ${salesMargin}%</p>
          <p>Please review and confirm your booking.</p>
        `,
      });

      res.json({ message: "Rate edited and margin added successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to edit rate and add margin", error });
    }
  }

  // A12: Sales selects best warehouse and edits rate (A12)
  async salesSelectBestWarehouseAndEditRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { warehouseId, salesMargin, salesPrice, notes } = req.body;
      
      // Only sales support can select warehouse and edit rates
      if ((req.user! as any).role !== "sales_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          warehouseId,
          salesMargin,
          salesPrice,
          salesNotes: notes,
          status: "rate_confirmed",
          finalPrice: salesPrice,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to customer
      await notificationService.sendEmail({
        to: (quote.customer as any).email,
        subject: `Best Warehouse Selected - Quote ${id}`,
        html: `
          <h2>Best Warehouse Selected</h2>
          <p>We have selected the best warehouse for your requirements and finalized the rate.</p>
          <p>Quote ID: ${id}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Selected Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Warehouse Location: ${(quote.warehouse as any).location}</p>
          <p>Final Price: $${salesPrice}</p>
          <p>Sales Margin: ${salesMargin}%</p>
          <p>Please review and confirm your booking.</p>
        `,
      });

      res.json({ message: "Best warehouse selected and rate edited successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to select warehouse and edit rate", error });
    }
  }

  // A13: Customer agrees with rate (A13)
  async customerAgreeWithRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      // Only customer can agree with rate
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          status: "customer_accepted",
          customerNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@warehousewizard.com", // TODO: Get actual supervisor email
        subject: `Customer Accepted Rate - Quote ${id}`,
        html: `
          <h2>Customer Accepted Rate</h2>
          <p>Customer has accepted the quoted rate and is ready to proceed with booking.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Company: ${(quote.customer as any).company || 'N/A'}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Final Price: $${quote.finalPrice}</p>
          <p>Customer Notes: ${notes || 'None'}</p>
          <p>Please review and approve the booking request.</p>
        `,
      });

      res.json({ message: "Rate accepted successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept rate", error });
    }
  }

  // A14: Customer rejects rate (A14)
  async customerRejectRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only customer can reject rate
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          status: "customer_rejected",
          customerNotes: reason,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to sales team
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // TODO: Get actual sales team email
        subject: `Customer Rejected Rate - Quote ${id}`,
        html: `
          <h2>Customer Rejected Rate</h2>
          <p>Customer has rejected the quoted rate and provided feedback.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Company: ${(quote.customer as any).company || 'N/A'}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Final Price: $${quote.finalPrice}</p>
          <p>Rejection Reason: ${reason || 'No reason provided'}</p>
          <p>Please review and adjust the rate accordingly.</p>
        `,
      });

      res.json({ message: "Rate rejected successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject rate", error });
    }
  }

  // A15: Customer agrees with rate (A15) - Alternative path
  async customerAgreeWithRateAlt(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      // Only customer can agree with rate
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          status: "customer_accepted",
          customerNotes: notes,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@warehousewizard.com", // TODO: Get actual supervisor email
        subject: `Customer Accepted Rate - Quote ${id}`,
        html: `
          <h2>Customer Accepted Rate</h2>
          <p>Customer has accepted the quoted rate and is ready to proceed with booking.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Company: ${(quote.customer as any).company || 'N/A'}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Final Price: $${quote.finalPrice}</p>
          <p>Customer Notes: ${notes || 'None'}</p>
          <p>Please review and approve the booking request.</p>
        `,
      });

      res.json({ message: "Rate accepted successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept rate", error });
    }
  }

  // A16: Customer rejects rate (A16) - Alternative path
  async customerRejectRateAlt(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only customer can reject rate
      if ((req.user! as any).role !== "customer") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: {
          status: "customer_rejected",
          customerNotes: reason,
          updatedAt: new Date() as any
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Send notification to sales team
      await notificationService.sendEmail({
        to: "sales@warehousewizard.com", // TODO: Get actual sales team email
        subject: `Customer Rejected Rate - Quote ${id}`,
        html: `
          <h2>Customer Rejected Rate</h2>
          <p>Customer has rejected the quoted rate and provided feedback.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Company: ${(quote.customer as any).company || 'N/A'}</p>
          <p>Storage Type: ${quote.storageType}</p>
          <p>Required Space: ${quote.requiredSpace} sq ft</p>
          <p>Warehouse: ${(quote.warehouse as any).name}</p>
          <p>Final Price: $${quote.finalPrice}</p>
          <p>Rejection Reason: ${reason || 'No reason provided'}</p>
          <p>Please review and adjust the rate accordingly.</p>
        `,
      });

      res.json({ message: "Rate rejected successfully", quote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject rate", error });
    }
  }
}

export const quoteController = new QuoteController();