import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../services/notificationService";
import { prisma } from "../config/prisma";

export class RFQController {
  async createRFQ(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, warehouseIds, validUntil, notes } = req.body;
      
      // Validate required fields
      if (!quoteId || !warehouseIds || !Array.isArray(warehouseIds) || warehouseIds.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: quoteId and warehouseIds array are required" 
        });
      }
      
      // Only purchase support can create RFQs
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Verify quote exists
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { customer: true }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify warehouses exist
      const warehouses = await prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } }
      });

      if (warehouses.length !== warehouseIds.length) {
        return res.status(400).json({ message: "One or more warehouses not found" });
      }

      // Create RFQs for each warehouse
      const rfqs = await Promise.all(
        warehouseIds.map((warehouseId: string) =>
          prisma.rFQ.create({
            data: {
              quoteId,
              warehouseId,
              validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
              notes,
              status: "sent",
            },
            include: {
              warehouse: { select: { name: true, location: true, city: true, state: true } },
              quote: { select: { customerId: true, storageType: true, requiredSpace: true } }
            }
          })
        )
      );

      // Update quote status
      await prisma.quote.update({
        where: { id: quoteId },
        data: { status: "warehouse_quote_requested" }
      });

      // Send notifications to warehouses
      for (const rfq of rfqs) {
        try {
          await notificationService.sendEmail({
            to: "warehouse@example.com", // TODO: Get actual warehouse email
            subject: `RFQ Request - Quote ${quoteId}`,
            html: `
              <h2>New RFQ Request</h2>
              <p>You have received a new Request for Quote.</p>
              <p>Quote ID: ${quoteId}</p>
              <p>Storage Type: ${(rfq.quote as any).storageType}</p>
              <p>Required Space: ${(rfq.quote as any).requiredSpace} sq ft</p>
              <p>Valid Until: ${new Date(rfq.validUntil!).toLocaleDateString()}</p>
              <p>Please respond with your rates and availability.</p>
            `,
          });
        } catch (emailError) {
          console.error("Failed to send notification email:", emailError);
          // Don't fail the entire request if email fails
        }
      }

      res.status(201).json(rfqs);
      return;
    } catch (error) {
      console.error("RFQ creation error:", error);
      return res.status(500).json({ 
        message: "Failed to create RFQ", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }

  async getRFQs(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let rfqs;

      if (user.role === "warehouse") {
        // Get RFQs for warehouse users
        // TODO: Link warehouse users to specific warehouses; currently returns all RFQs
        // Return all statuses so the UI can compute Pending/Responded/Expired
        rfqs = await prisma.rFQ.findMany({
          include: {
            quote: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } }
              }
            },
            warehouse: { select: { name: true, location: true } },
            rates: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        // Get all RFQs for purchase support, sales support, supervisor, admin
        rfqs = await prisma.rFQ.findMany({
          include: {
            quote: { 
              include: { 
                customer: { select: { firstName: true, lastName: true, email: true, company: true } }
              }
            },
            warehouse: { select: { name: true, location: true } },
            rates: true
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      res.json(rfqs);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch RFQs", error });
    }
  }

  async getRFQById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: {
          quote: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          rates: true
        }
      });

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      res.json(rfq);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch RFQ", error });
    }
  }

  async submitRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rate, termsAndConditions, remark } = req.body;
      
      console.log(`[DEBUG] submitRate called for RFQ ${id}`);
      console.log(`[DEBUG] Rate data:`, { rate, termsAndConditions, remark });
      
      // Only warehouse can submit rates
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Check if RFQ exists and is still valid
      const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: { warehouse: true }
      });

      console.log(`[DEBUG] RFQ found:`, rfq ? `Yes, quoteId: ${rfq.quoteId}` : 'No');

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      if (rfq.validUntil && new Date() > rfq.validUntil) {
        return res.status(400).json({ message: "RFQ has expired" });
      }

      // Lock: allow rate submission only when RFQ is in "sent" state
      // Block if RFQ has already been responded/expired/cancelled
      if (rfq.status !== "sent") {
        return res.status(409).json({ message: "RFQ already responded; cannot submit another rate" });
      }

      // Create rate
      const rateRecord = await prisma.rate.create({
        data: {
          rfqId: id,
          warehouseId: rfq.warehouseId,
          rate: parseFloat(rate),
          termsAndConditions: termsAndConditions || null,
          remark: remark || null,
          status: "pending",
        },
        include: {
          warehouse: { select: { name: true, location: true } }
        }
      });

      // Update RFQ status
      await prisma.rFQ.update({
        where: { id },
        data: { 
          status: "responded",
          respondedAt: new Date()
        }
      });

      // Update quote status to indicate warehouse quote received
      console.log(`Updating quote ${rfq.quoteId} status to warehouse_quote_received`);
      try {
        const updatedQuote = await prisma.quote.update({
          where: { id: rfq.quoteId },
          data: { status: "warehouse_quote_received" }
        });
        console.log(`Quote ${rfq.quoteId} status updated to:`, updatedQuote.status);
      } catch (quoteUpdateError) {
        console.error(`Failed to update quote ${rfq.quoteId} status:`, quoteUpdateError);
        // Don't fail the entire request if quote update fails
      }

      // Send notification to purchase support
      await notificationService.sendEmail({
        to: "purchase@example.com", // TODO: Get actual purchase support email
        subject: `Rate Received - RFQ ${id}`,
        html: `
          <h2>Rate Received</h2>
          <p>Warehouse ${(rateRecord.warehouse as any).name} has submitted a rate for RFQ ${id}.</p>
          <p>Rate: ₹${rate}</p>
          <p>Terms & Conditions: ${termsAndConditions || 'N/A'}</p>
          <p>Remark: ${remark || 'N/A'}</p>
        `,
      });

      res.status(201).json(rateRecord);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to submit rate", error });
    }
  }

  async updateRFQStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const rfq = await prisma.rFQ.update({
        where: { id },
        data: { status },
        include: {
          warehouse: { select: { name: true, location: true } },
          quote: { select: { customerId: true } }
        }
      });

      res.json(rfq);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to update RFQ status", error });
    }
  }

  async getRatesByRFQ(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const rates = await prisma.rate.findMany({
        where: { rfqId: id },
        include: {
          warehouse: { select: { name: true, location: true, city: true, state: true } }
        },
        orderBy: { rate: 'asc' }
      });

      res.json(rates);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch rates", error });
    }
  }

  async selectRate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rateId } = req.body;
      
      // Only purchase support can select rates
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get the selected rate
      const selectedRate = await prisma.rate.findUnique({
        where: { id: rateId },
        include: { rfq: { include: { quote: true } } }
      });

      if (!selectedRate) {
        return res.status(404).json({ message: "Rate not found" });
      }

      // Update quote with selected warehouse and rate
      await prisma.quote.update({
        where: { id: (selectedRate.rfq as any).quoteId },
        data: {
          warehouseId: selectedRate.warehouseId,
          finalPrice: selectedRate.rate,
          status: "rate_confirmed"
        }
      });

      // Update rate status
      await prisma.rate.update({
        where: { id: rateId },
        data: { status: "accepted" }
      });

      // Reject other rates for this RFQ
      await prisma.rate.updateMany({
        where: { 
          rfqId: (selectedRate.rfq as any).id,
          id: { not: rateId }
        },
        data: { status: "rejected" }
      });

      res.json({ message: "Rate selected successfully", rate: selectedRate });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to select rate", error });
    }
  }

  // Warehouse Panel: Accept/Reject RFQ requests (A5-A8)
  async acceptRFQ(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      // Only warehouse can accept RFQs
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: { 
          warehouse: true,
          quote: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          }
        }
      });

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      // Update RFQ status to accepted
      const updatedRFQ = await prisma.rFQ.update({
        where: { id },
        data: { 
          status: "responded",
          notes: notes ? `${rfq.notes || ''}\nWarehouse Notes: ${notes}` : rfq.notes
        },
        include: {
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          quote: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          }
        }
      });

      // Send notification to purchase support
      await notificationService.sendEmail({
        to: "purchase@warehousewizard.com", // This should be dynamic
        subject: "RFQ Accepted by Warehouse",
        html: `
          <h2>RFQ Accepted by Warehouse</h2>
          <p>RFQ ID: ${rfq.id}</p>
          <p>Customer: ${rfq.quote?.customer?.firstName} ${rfq.quote?.customer?.lastName}</p>
          <p>Warehouse: ${rfq.warehouse?.name}</p>
          <p>Status: Ready for rate submission</p>
        `
      });

      res.json({ message: "RFQ accepted successfully", rfq: updatedRFQ });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to accept RFQ", error });
    }
  }

  async rejectRFQ(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Only warehouse can reject RFQs
      if ((req.user! as any).role !== "warehouse") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: { 
          warehouse: true,
          quote: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          }
        }
      });

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      // Update RFQ status to rejected
      const updatedRFQ = await prisma.rFQ.update({
        where: { id },
        data: { 
          status: "cancelled",
          notes: reason ? `${rfq.notes || ''}\nRejection Reason: ${reason}` : rfq.notes
        },
        include: {
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          quote: { 
            include: { 
              customer: { select: { firstName: true, lastName: true, email: true, company: true } }
            }
          }
        }
      });

      // Send notification to purchase support
      await notificationService.sendEmail({
        to: "purchase@warehousewizard.com", // This should be dynamic
        subject: "RFQ Rejected by Warehouse",
        html: `
          <h2>RFQ Rejected by Warehouse</h2>
          <p>RFQ ID: ${rfq.id}</p>
          <p>Customer: ${rfq.quote?.customer?.firstName} ${rfq.quote?.customer?.lastName}</p>
          <p>Warehouse: ${rfq.warehouse?.name}</p>
          <p>Reason: ${reason || "No specific reason provided"}</p>
        `
      });

      res.json({ message: "RFQ rejected", rfq: updatedRFQ });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to reject RFQ", error });
    }
  }

  // New method: Purchase Support assigns warehouse to sales (A9, A10)
  async assignWarehouseToSales(req: AuthenticatedRequest, res: Response) {
    try {
      const { rfqId, rateId, salesUserId } = req.body;
      
      // Only purchase support can assign to sales
      if ((req.user! as any).role !== "purchase_support") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get the rate and RFQ details
      const rate = await prisma.rate.findUnique({
        where: { id: rateId },
        include: {
          rfq: { include: { quote: true } },
          warehouse: { select: { name: true, location: true } }
        }
      });

      if (!rate) {
        return res.status(404).json({ message: "Rate not found" });
      }

      // Update rate status to accepted
      await prisma.rate.update({
        where: { id: rateId },
        data: { status: "accepted" }
      });

      // Fetch quote and ensure it is not already assigned/advanced
      const quote = await prisma.quote.findUnique({ where: { id: rate.rfq.quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      const assignableStatuses = ["warehouse_quote_received", "rate_confirmed"] as const;
      if (quote.assignedTo || !assignableStatuses.includes(quote.status as any)) {
        return res.status(409).json({ message: "Quote already assigned or progressed; cannot reassign" });
      }

      // Update quote with selected warehouse and rate
      await prisma.quote.update({
        where: { id: rate.rfq.quoteId },
        data: {
          warehouseId: rate.warehouseId,
          finalPrice: rate.rate,
          assignedTo: salesUserId,
          status: "processing"
        }
      });

      // Send notification to sales support
      await notificationService.sendEmail({
        to: "sales@example.com", // TODO: Get actual sales email
        subject: `Warehouse Assigned - Quote ${rate.rfq.quoteId}`,
        html: `
          <h2>Warehouse Assigned</h2>
          <p>A warehouse has been assigned to you for quote processing.</p>
          <p>Quote ID: ${rate.rfq.quoteId}</p>
          <p>Warehouse: ${(rate.warehouse as any).name}</p>
          <p>Rate: ₹${rate.rate}</p>
          <p>Please review and add margin before sending to customer.</p>
        `,
      });

      res.json({ message: "Warehouse assigned to sales successfully" });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to assign warehouse to sales", error });
    }
  }
}

export const rfqController = new RFQController();