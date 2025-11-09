import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { QuoteStatus } from "@prisma/client";
import { z } from "zod";
import { notificationService } from "../services/notificationService";
import { cacheService } from "../services/cacheService";

const insertQuoteSchema = z.object({
  customerId: z.string(),
  storageType: z.string(),
  requiredSpace: z.number(),
  preferredLocation: z.string(),
  duration: z.string(),
  specialRequirements: z.string().optional(),
});

const safeNumber = (fallback: number) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().default(fallback));

const quoteSearchSchema = z.object({
  status: z.string().optional(),
  storageType: z.string().optional(),
  page: safeNumber(1),
  limit: safeNumber(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class QuoteController {
  createQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = (req.user! as any).id;
      
      // Handle specialized forms differently
      if (req.body.formType) {
        // Extract only the special requirements from the form data
        const specialRequirements = {
          productName: req.body.productName,
          natureOfCargo: req.body.natureOfCargo,
          numberOfPackages: req.body.numberOfPackages,
          packageUnit: req.body.packageUnit,
          assessableValue: req.body.assessableValue,
          cargoSelfLife: req.body.cargoSelfLife,
          unNumber: req.body.unNumber,
          requiredTemp: req.body.requiredTemp,
          hazardousClass: req.body.hazardousClass,
          stackable: req.body.stackable,
          equipmentsRequirement: req.body.equipmentsRequirement,
          packagingRequirement: req.body.packagingRequirement,
          labourRequirement: req.body.labourRequirement,
          remarks: req.body.remarks || req.body.salesNotes || req.body.additionalCharges || "No additional remarks"
        };

        // Remove null/undefined values
        const cleanedSpecialRequirements = Object.fromEntries(
          Object.entries(specialRequirements).filter(([_, value]) => value !== null && value !== undefined && value !== "")
        );

        const quote = await prisma.quote.create({
          data: {
            customerId: customerId,
            storageType: req.body.formType, // Use formType as storageType
            requiredSpace: req.body.spaceRequired || req.body.requiredSpace || 0,
            preferredLocation: req.body.origin || req.body.preferredLocation || "Not specified",
            duration: req.body.storagePeriod ? `${req.body.storagePeriod} days` : "Not specified",
            specialRequirements: JSON.stringify(cleanedSpecialRequirements), // Store only relevant special requirements
            status: "pending",
            warehouseId: req.body.warehouseId || null,
            // Initialize workflow state
            currentWorkflowStep: "C1",
            workflowHistory: [{
              step: "C1",
              role: "customer",
              action: "Submit Quote Request",
              timestamp: new Date(),
              details: `Quote created for ${req.body.formType} storage`
            }]
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } }
          }
        });

        // Send notification to purchase panel
        await notificationService.sendWorkflowNotification(
          quote.id, 
          "C1", 
          "C2", 
          quote.customer, 
          null
        );

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
          // Initialize workflow state
          currentWorkflowStep: "C1",
          workflowHistory: [{
            step: "C1",
            role: "customer",
            action: "Submit Quote Request",
            timestamp: new Date(),
            details: `Quote created for ${quoteData.storageType} storage`
          }]
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } }
        }
      });

      // Send notification to purchase panel
      await notificationService.sendWorkflowNotification(
        quote.id, 
        "C1", 
        "C2", 
        quote.customer, 
        null
      );

      res.status(201).json(quote);
      return;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid quote data", errors: error.issues });
      }
      return res.status(500).json({ message: "Failed to create quote", error });
    }
  }

  // Debugging helper: return counts and sample IDs for important statuses
  debugSummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Ensure authenticated
      if (!req.user) return res.sendStatus(401);
      const statuses = [
        'processing',
        'supervisor_review_pending',
        'quoted',
        'customer_confirmation_pending',
        'booking_confirmed',
        'rejected'
      ];

      const result: any = {};
      for (const status of statuses) {
        const st = status as unknown as QuoteStatus;
        const items = await prisma.quote.findMany({ where: { status: st }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 5 });
        // count total separately
        const count = await prisma.quote.count({ where: { status: st } });
        result[status] = { count, sampleIds: items.map(i => i.id) };
      }

      res.json({ user: { id: (req.user as any).id, role: (req.user as any).role }, summary: result });
      return;
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch debug summary', error });
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
        // Purchase support should see all quotes in the workflow to track complete history
        quotes = await prisma.quote.findMany({
          where: {
            status: { in: [
              "pending",
              "warehouse_quote_requested", 
              "warehouse_quote_received",
              "processing",
              "quoted",
              "customer_confirmation_pending",
              "booking_confirmed",
              "rejected"
            ] }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
      } else if (user.role === "sales_support") {
        // Sales support should see all quotes in the workflow to track complete history
        quotes = await prisma.quote.findMany({
          where: {
            status: { in: [
              "processing",
              // include quotes sales has forwarded to supervisor for review
              "supervisor_review_pending",
              "quoted",
              "customer_confirmation_pending",
              "booking_confirmed",
              "rejected"
            ] as any }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
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
        console.log("confirmQuote - Creating booking for quote:", id);
        console.log("confirmQuote - Quote data:", {
          id,
          customerId: quote.customerId,
          warehouseId: quote.warehouseId,
          finalPrice: quote.finalPrice
        });
        
        let booking;
        try {
          booking = await prisma.booking.create({
            data: {
              quoteId: id,
              customerId: quote.customerId,
              warehouseId: quote.warehouseId!,
              status: "pending",
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
              totalAmount: quote.finalPrice || 0,
            },
            include: {
              customer: { select: { firstName: true, lastName: true, email: true } },
              warehouse: { select: { name: true, location: true } }
            }
          });
          console.log("confirmQuote - Booking created successfully:", booking);
        } catch (bookingError) {
          console.error("confirmQuote - Failed to create booking:", bookingError);
          return res.status(500).json({ 
            message: "Failed to create booking", 
            error: bookingError,
            quoteId: id 
          });
        }
        
        // Update quote status to customer_confirmation_pending (Step 7)
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
      
      // Lock: can approve only when quote is in a sales-review state
      const existing = await prisma.quote.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Quote not found" });
      }
      if (!["processing", "rate_confirmed"].includes(existing.status)) {
        return res.status(409).json({ message: "Quote cannot be approved in current state", currentStatus: existing.status });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          // Send to Supervisor next per workflow; customer sees confirm only after supervisor review
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
      
      const existing = await prisma.quote.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Quote not found" });
      }
      // Allow reject from processing/quoted by sales/supervisor; block after booking
      if (["booking_confirmed", "customer_confirmation_pending"].includes(existing.status)) {
        return res.status(409).json({ message: "Quote cannot be rejected in current state", currentStatus: existing.status });
      }

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

  // Supervisor approves rate to route to customer for confirmation
  supervisorApproveQuote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const role = (req.user! as any).role;
      if (!["supervisor", "admin"].includes(role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const existing = await prisma.quote.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Only allow from supervisor_review_pending, quoted or rate_confirmed (i.e., after sales rate confirmation)
      if (!["supervisor_review_pending", "quoted", "rate_confirmed"].includes(existing.status)) {
        return res.status(409).json({ message: "Quote is not awaiting supervisor review", currentStatus: existing.status });
      }

      const updated = await prisma.quote.update({
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

      // Invalidate customer quotes cache to ensure fresh data
      await cacheService.invalidateUserQuotes(updated.customerId);

      // Optional: notify customer
      await notificationService.sendEmail({
        to: (updated.customer as any)?.email || "",
        subject: `Action Required: Quote Confirmation - ${id}`,
        html: `
          <h2>Your Quote is Ready for Confirmation</h2>
          <p>Please review the final rate and confirm to proceed with booking.</p>
          <p>Quote ID: ${id}</p>
        `,
      });

      res.json(updated);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to move quote to customer confirmation", error });
    }
  }

  // Customer quote confirmation (agree/reject rate)
  confirmQuoteByCustomer = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Parse the request body properly
      let requestData;
      try {
        if (typeof req.body === 'string') {
          requestData = JSON.parse(req.body);
        } else if (req.body.body && typeof req.body.body === 'string') {
          requestData = JSON.parse(req.body.body);
        } else {
          requestData = req.body;
        }
      } catch (parseError) {
        console.log("[DEBUG] JSON Parse Error:", parseError);
        console.log("[DEBUG] Raw body:", req.body);
        return res.status(400).json({ message: "Invalid JSON in request body" });
      }
      
      const { confirmed, bookingData, reason } = requestData;
      const customerId = (req.user as any)?.id || (req.user as any)?._id?.toString();
      
      console.log("[DEBUG] confirmQuoteByCustomer - Quote ID:", id);
      console.log("[DEBUG] confirmQuoteByCustomer - Confirmed:", confirmed);
      console.log("[DEBUG] confirmQuoteByCustomer - Reason:", reason);
      console.log("[DEBUG] confirmQuoteByCustomer - Customer ID:", customerId);
      console.log("[DEBUG] confirmQuoteByCustomer - Request body:", req.body);
      console.log("[DEBUG] confirmQuoteByCustomer - Parsed data:", requestData);
      
      // Verify customer owns this quote
      const quote = await prisma.quote.findFirst({
        where: { id, customerId }
      });
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      if (confirmed === true) {
        // Customer agrees with rate - set status to customer_confirmed (Step 7 done, awaiting supervisor)
        console.log("[DEBUG] Setting quote status to customer_confirmed - Step 7 completed");
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { 
            status: "customer_confirmed",
            updatedAt: new Date()
          },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } }
          }
        });
        
        // Send notification to supervisor for final confirmation (Step 7 → Step 8)
        await notificationService.sendEmail({
          to: "supervisor@example.com", // TODO: Get actual supervisor email
          subject: `Customer Confirmed Booking - Quote ${id}`,
          html: `
            <h2>Customer Confirmed Booking</h2>
            <p>Customer has confirmed the booking and it's ready for supervisor approval.</p>
            <p>Quote ID: ${id}</p>
            <p>Customer: ${(updatedQuote.customer as any)?.firstName} ${(updatedQuote.customer as any)?.lastName}</p>
            <p>Final Price: ₹${quote.finalPrice?.toLocaleString() || 'N/A'}</p>
            <p>Please review and confirm the booking.</p>
          `,
        });
        
        // Ensure a pending booking exists for supervisor approval
        let existingBooking = await prisma.booking.findFirst({ where: { quoteId: id } });
        if (!existingBooking) {
          existingBooking = await prisma.booking.create({
            data: {
              quoteId: id,
              customerId,
              warehouseId: quote.warehouseId!,
              status: "pending",
              startDate: new Date(bookingData?.startDate || Date.now()),
              endDate: new Date(bookingData?.endDate || Date.now() + 30 * 24 * 3600 * 1000),
              totalAmount: quote.finalPrice || 0,
            },
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true, city: true, state: true } }
            }
          });
        }

        return res.json({ quote: updatedQuote, booking: existingBooking });
      } else {
        // Customer rejects rate
        console.log("[DEBUG] Setting quote status to rejected");
        const updatedQuote = await prisma.quote.update({
          where: { id },
          data: { 
            status: "rejected",
            specialRequirements: reason ? `Rejected by customer: ${reason}` : "Rejected by customer",
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
      
      const existingQuote = await prisma.quote.findUnique({
        where: { id }
      });

      if (!existingQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const quote = await prisma.quote.update({
        where: { id },
        data: { 
          finalPrice,
          specialRequirements: notes ? `Sales notes: ${notes}` : existingQuote.specialRequirements,
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
      console.log(`[DEBUG] getQuotesForRole - role=${user.role} userId=${user.id} found=${Array.isArray(quotes) ? quotes.length : 0}`);
      if (Array.isArray(quotes) && quotes.length > 0) {
        console.log(`[DEBUG] getQuotesForRole - sample IDs: ${quotes.slice(0,5).map((q:any)=>q.id).join(',')}`);
      }
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
          finalPrice: true, // Include finalPrice for customers to see rates sent by sales
          createdAt: true,
          updatedAt: true,
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
        // Purchase support should see all quotes in the workflow to track complete history
        return await prisma.quote.findMany({
          where: {
            status: { in: [
              "pending",
              "warehouse_quote_requested", 
              "warehouse_quote_received",
              "processing",
              "quoted",
              "customer_confirmation_pending",
              "booking_confirmed",
              "rejected"
            ] }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
      case "sales_support":
        // Sales support should see all quotes in sales-relevant stages, regardless of assignment
        return await prisma.quote.findMany({
          where: {
            status: { in: [
              "processing",
              // include quotes sales has forwarded to supervisor for review
              "supervisor_review_pending",
              // After sales submits rate, it moves to supervisor as 'quoted'
              "quoted",
              // After supervisor approves, it becomes 'customer_confirmation_pending'
              "customer_confirmation_pending",
            ] as any }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
      case "warehouse":
        return await QuoteController.getQuotesByAssignee(userId);
      case "supervisor":
        // Supervisor should see all quotes in the workflow to track complete history
        return await prisma.quote.findMany({
          where: {
            status: { in: [
              "supervisor_review_pending", // Quotes from sales awaiting supervisor review
              "quoted", // Quotes from sales awaiting supervisor review
              "customer_confirmation_pending", // Quotes approved by supervisor, awaiting customer
              "customer_confirmed", // Customer confirmed quotes awaiting supervisor approval (Step 7)
              "booking_confirmed", // Confirmed bookings
              "rejected" // Rejected quotes
            ] as any }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true, city: true, state: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        });
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

  // Sales Support: Edit rate and add margin (A11, A12)
  async salesEditRateAndAddMargin(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { margin, finalPrice, notes } = req.body;
      
      // Only sales support can edit rates
      if ((req.user! as any).role !== "sales_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Locking rule: Sales can edit only when the quote is in "processing"
      // and assigned to the current sales user. Once moved to other statuses
      // (e.g., quoted, customer_confirmation_pending, booking_confirmed, etc.),
      // prevent further edits.
      const isOwnedBySales = quote.assignedTo && quote.assignedTo === (req.user as any).id;
      if (quote.status !== "processing" || !isOwnedBySales) {
        return res.status(409).json({
          message: "Quote cannot be edited in its current state",
          currentStatus: quote.status,
        });
      }

      // Update quote with final price and margin
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: {
          finalPrice,
          specialRequirements: notes ? `${quote.specialRequirements || ''}\nSales Notes: ${notes}` : quote.specialRequirements,
          // Move to supervisor review step per workflow
          status: "supervisor_review_pending" as any
        },
        include: { customer: true }
      });

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@warehousewizard.com", // TODO: Get actual supervisor email
        subject: `Quote Ready for Supervisor Review - ${id}`,
        html: `
          <h2>Quote Ready for Supervisor Review</h2>
          <p>A quote has been prepared by sales support and requires your review and approval.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(updatedQuote.customer as any).firstName} ${(updatedQuote.customer as any).lastName}</p>
          <p>Final Price: ₹${finalPrice}</p>
          <p>Please review and approve before sending to customer.</p>
        `,
      });

      res.json({ message: "Rate updated and sent to supervisor for review", quote: updatedQuote });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update rate", error });
    }
  }

  // Customer: Agree with rate (A13, A15)
  async customerAgreeWithRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      
      // Only customer can agree with rates
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

      // Update quote status
      await prisma.quote.update({
        where: { id },
        data: { status: "customer_confirmation_pending" }
      });

      // Create booking request
      const booking = await prisma.booking.create({
        data: {
          quoteId: id,
          customerId: quote.customerId,
          warehouseId: quote.warehouseId!,
          status: "pending",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          totalAmount: quote.finalPrice || 0,
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Send notification to supervisor
      await notificationService.sendEmail({
        to: "supervisor@example.com", // TODO: Get actual supervisor email
        subject: `Booking Request - ${id}`,
        html: `
          <h2>New Booking Request</h2>
          <p>Customer has agreed with the rate and submitted a booking request.</p>
          <p>Quote ID: ${id}</p>
          <p>Booking ID: ${booking.id}</p>
          <p>Customer: ${(booking.customer as any).firstName} ${(booking.customer as any).lastName}</p>
          <p>Amount: ₹${booking.totalAmount}</p>
          <p>Please review and approve the booking.</p>
        `,
      });

      res.json({ message: "Rate agreed and booking created", booking });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to agree with rate", error });
    }
  }

  // Customer: Reject rate (A14, A16)
  async customerRejectRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only customer can reject rates
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

      // Update quote status
      await prisma.quote.update({
        where: { id },
        data: { 
          status: "rejected",
          specialRequirements: reason ? `${quote.specialRequirements || ''}\nCustomer Rejection: ${reason}` : quote.specialRequirements
        }
      });

      // Send notification to sales support
      await notificationService.sendEmail({
        to: "sales@example.com", // TODO: Get actual sales email
        subject: `Rate Rejected - ${id}`,
        html: `
          <h2>Rate Rejected by Customer</h2>
          <p>Customer has rejected the proposed rate.</p>
          <p>Quote ID: ${id}</p>
          <p>Customer: ${(quote.customer as any).firstName} ${(quote.customer as any).lastName}</p>
          <p>Reason: ${reason || 'No reason provided'}</p>
          <p>Please review and provide alternative options.</p>
        `,
      });

      res.json({ message: "Rate rejected" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject rate", error });
    }
  }

  async getPendingWarehouseQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const pendingQuotes = await prisma.quote.findMany({
        where: {
          status: "warehouse_quote_requested"
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(pendingQuotes);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending warehouse quotes", error });
    }
  }
}

export const quoteController = new QuoteController();