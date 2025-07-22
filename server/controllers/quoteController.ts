import { Request, Response } from "express";
import { quoteService } from "../services/quoteService";
import { insertQuoteSchema } from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

const quoteSearchSchema = z.object({
  status: z.string().optional(),
  storageType: z.string().optional(),
  page: z.string().transform(val => parseInt(val) || 1).default('1'),
  limit: z.string().transform(val => parseInt(val) || 20).default('20'),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class QuoteController {
  async createQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const quoteData = insertQuoteSchema.parse({
        ...req.body,
        customerId: req.user!._id.toString(),
      });
      
      const quote = await quoteService.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid quote data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create quote", error });
    }
  }

  async getQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      let quotes;

      if (user.role === "customer") {
        quotes = await quoteService.getQuotesByCustomer(user._id.toString());
      } else if (user.role === "purchase_support") {
        quotes = await quoteService.getQuotesByStatus("pending");
      } else if (user.role === "sales_support") {
        quotes = await quoteService.getQuotesByStatus("processing");
      } else if (user.role === "warehouse") {
        quotes = await quoteService.getQuotesByAssignee(user._id.toString());
      } else {
        // Admin, supervisor can see all
        const searchParams = quoteSearchSchema.parse(req.query);
        const result = await quoteService.searchQuotes(searchParams);
        return res.json(result);
      }

      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes", error });
    }
  }

  async getQuoteById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await quoteService.getQuoteById(id);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Check permissions
      const user = req.user!;
      if (user.role === "customer" && quote.customerId._id.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quote", error });
    }
  }

  async updateQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const quote = await quoteService.updateQuote(id, updateData);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to update quote", error });
    }
  }

  async assignQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      
      // Only purchase support can assign quotes
      if (req.user!.role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await quoteService.assignQuote(id, assignedTo);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign quote", error });
    }
  }

  async approveQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { finalPrice, warehouseId } = req.body;
      
      // Only sales support and supervisors can approve quotes
      if (!["sales_support", "supervisor"].includes(req.user!.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const quote = await quoteService.approveQuote(id, finalPrice, warehouseId);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve quote", error });
    }
  }

  async rejectQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const quote = await quoteService.rejectQuote(id, reason);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject quote", error });
    }
  }

  async getQuotesForRole(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const quotes = await quoteService.getQuotesForRole(user.role, user._id.toString());
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes for role", error });
    }
  }

  async calculateQuotePrice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const price = await quoteService.calculateQuotePrice(id);
      
      if (price === null) {
        return res.status(400).json({ message: "Unable to calculate price" });
      }
      
      res.json({ estimatedPrice: price });
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate quote price", error });
    }
  }

  // Get quotes by status for different roles
  async getPendingQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await quoteService.getQuotesByStatus("pending");
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending quotes", error });
    }
  }

  async getProcessingQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await quoteService.getQuotesByStatus("processing");
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing quotes", error });
    }
  }

  async getQuotedQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const quotes = await quoteService.getQuotesByStatus("quoted");
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quoted quotes", error });
    }
  }
}

export const quoteController = new QuoteController();