import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";

export class WorkflowStateController {
  private getActor(req: AuthenticatedRequest) {
    const user = (req.user || {}) as any;
    return { userId: user.id, role: user.role };
  }

  private async appendHistory(quoteId: string, fromStep: string | null, toStep: string, action: string, actor: { userId?: string; role?: string }, extra?: Record<string, any>) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    const history: any[] = Array.isArray((quote as any)?.workflowHistory) ? (quote as any).workflowHistory : [];
    history.push({
      at: new Date().toISOString(),
      fromStep,
      toStep,
      action,
      actorRole: actor.role,
      actorUserId: actor.userId,
      ...extra,
    });
    await prisma.quote.update({
      where: { id: quoteId },
      data: { workflowHistory: history, currentWorkflowStep: toStep },
    });
  }

  private roleAllowedSteps: Record<string, Set<string>> = {
    purchase_support: new Set(["C2", "C3", "C4", "C9", "C10"]),
    warehouse: new Set(["C5", "C6", "C7", "C8", "C24", "C29", "C30", "C33"]),
    sales_support: new Set(["C11", "C12"]),
    customer: new Set(["C1", "C13", "C14", "C15", "C16", "C21", "C25", "C28", "C31"]),
    supervisor: new Set(["C17", "C18", "C19", "C20", "C22", "C23", "C26", "C27", "C32"]),
  };
  // Admin: Get a customer's latest quote workflow snapshot
  async getCustomerLatestWorkflow(req: AuthenticatedRequest, res: Response) {
    try {
      const { customerId } = req.params;

      const quote = await prisma.quote.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      if (!quote) {
        return res.json({
          customerId,
          hasQuote: false,
          currentStep: null,
          flowType: null,
          workflowHistory: [],
          nextSteps: [],
          pendingActions: [],
        });
      }

      return res.json({
        customerId,
        hasQuote: true,
        quoteId: quote.id,
        currentStep: "C1",
        flowType: "FLOW_A_SAME_WAREHOUSE",
        workflowHistory: [],
        nextSteps: [],
        pendingActions: [],
        quote: {
          id: quote.id,
          status: quote.status,
          createdAt: quote.createdAt,
          customer: quote.customer,
          warehouse: quote.warehouse,
          assignedToUser: quote.assignedToUser,
        },
      });
    } catch (error) {
      console.error("Error in getCustomerLatestWorkflow:", error);
      return res.status(500).json({ message: "Failed to fetch customer's workflow", error });
    }
  }

  // Get current workflow state for a quote
  async getWorkflowState(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true, location: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      return res.json({
        quoteId,
        currentStep: "C1",
        flowType: "FLOW_A_SAME_WAREHOUSE",
        workflowHistory: [],
        nextSteps: [],
        pendingActions: [],
        quote: {
          id: quote.id,
          status: quote.status,
          customer: quote.customer,
          warehouse: quote.warehouse,
          assignedToUser: quote.assignedToUser
        }
      });
    } catch (error) {
      console.error("Error in getWorkflowState:", error);
      return res.status(500).json({ message: "Failed to get workflow state", error });
    }
  }

  // Get pending actions for a specific role
  async getPendingActionsForRole(req: AuthenticatedRequest, res: Response) {
    try {
      const actor = this.getActor(req);
      const allowed = this.roleAllowedSteps[actor.role || ''] || new Set<string>();
      if (allowed.size === 0) return res.json({ pendingActions: [] });

      const steps = Array.from(allowed);
      const quotes = await prisma.quote.findMany({
        where: { currentWorkflowStep: { in: steps } },
        select: { id: true, customerId: true, status: true, currentWorkflowStep: true, flowType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return res.json({ pendingActions: quotes });
    } catch (error) {
      console.error("Error in getPendingActionsForRole:", error);
      return res.status(500).json({ message: "Failed to get pending actions", error });
    }
  }

  // Transition workflow to next step (state-machine entrypoint)
  async transitionWorkflow(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { nextStep, flowType, action } = req.body as { nextStep: string; flowType?: string; action?: string };
      const actor = this.getActor(req);

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Authorization: ensure role can move into this step
      if (!actor.role || !this.roleAllowedSteps[actor.role]?.has(nextStep)) {
        return res.status(403).json({ message: `Role ${actor.role} not allowed to transition to ${nextStep}` });
      }

      // Persist flowType if provided (C3/C4 branching)
      const updates: any = {};
      if (flowType) updates.flowType = flowType;

      // Hooks: create booking on supervisor approval
      if (nextStep === "C17" || nextStep === "C19") {
        const existingBooking = await prisma.booking.findFirst({ where: { quoteId } });
        if (!existingBooking) {
          if (!quote.warehouseId) {
            return res.status(400).json({ message: "Warehouse must be selected before supervisor approval" });
          }
          await prisma.booking.create({
            data: {
              quoteId,
              customerId: quote.customerId,
              warehouseId: quote.warehouseId,
              status: 'confirmed',
              startDate: new Date(),
              endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
              totalAmount: quote.finalPrice || 0,
            }
          });
        }
      }

      await prisma.quote.update({ where: { id: quoteId }, data: { ...updates, currentWorkflowStep: nextStep } });
      await this.appendHistory(quoteId, (quote as any).currentWorkflowStep || null, nextStep, action || 'transition', actor);

      const updated = await prisma.quote.findUnique({ where: { id: quoteId } });
      return res.json({ message: 'OK', quote: updated });
    } catch (error) {
      console.error("Error in transitionWorkflow:", error);
      return res.status(500).json({ message: "Failed to transition workflow", error });
    }
  }

  // Purchase Panel: Handle C2 - Accept/Reject with Flow branching
  async handlePurchaseAcceptReject(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { action, flowType } = req.body;

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (action === "reject") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "rejected" } });
        return res.json({ message: "Quote rejected successfully" });
      }

      if (action === "accept") {
        await prisma.quote.update({
          where: { id: quoteId },
          data: { status: "warehouse_quote_requested" },
        });
        return res.json({ message: "Quote accepted successfully", flowType: flowType || "C3" });
      }

      return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
    } catch (error) {
      console.error("Error in handlePurchaseAcceptReject:", error);
      return res.status(500).json({ message: "Failed to process purchase action", error });
    }
  }

  // Warehouse Panel: Handle C5/C6/C7/C8 - Accept/Reject warehouse quotes
  async handleWarehouseAcceptReject(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { action } = req.body;

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (action === "reject") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "rejected" } });
        return res.json({ message: "Quote rejected by warehouse" });
      }

      if (action === "accept") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "warehouse_quote_received" } });
        return res.json({ message: "Quote accepted by warehouse" });
      }

      return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
    } catch (error) {
      console.error("Error in handleWarehouseAcceptReject:", error);
      return res.status(500).json({ message: "Failed to process warehouse action", error });
    }
  }

  // Sales Panel: Handle C11/C12 - Edit rates and add margin
  async handleSalesRateEdit(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { finalPrice } = req.body;

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      await prisma.quote.update({
        where: { id: quoteId },
        data: { finalPrice, status: "quoted" },
      });

      return res.json({ message: "Rate updated successfully" });
    } catch (error) {
      console.error("Error in handleSalesRateEdit:", error);
      return res.status(500).json({ message: "Failed to update rate", error });
    }
  }

  // Customer Panel: Handle C13/C15 - Agree/Reject rates
  async handleCustomerAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { action } = req.body;

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (action === "reject") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "rejected" } });
        return res.json({ message: "Quote rejected by customer" });
      }

      if (action === "agree") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "customer_confirmation_pending" } });
        return res.json({ message: "Quote agreed by customer" });
      }

      return res.status(400).json({ message: "Invalid action. Use 'agree' or 'reject'" });
    } catch (error) {
      console.error("Error in handleCustomerAgreement:", error);
      return res.status(500).json({ message: "Failed to process customer action", error });
    }
  }

  // Supervisor Panel: Handle C17/C19 - Accept/Reject bookings
  async handleSupervisorApproval(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { action } = req.body;

      const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (action === "reject") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "rejected" } });
        return res.json({ message: "Booking rejected by supervisor" });
      }

      if (action === "accept") {
        await prisma.quote.update({ where: { id: quoteId }, data: { status: "booking_confirmed" } });
        return res.json({ message: "Booking approved by supervisor" });
      }

      return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
    } catch (error) {
      console.error("Error in handleSupervisorApproval:", error);
      return res.status(500).json({ message: "Failed to process supervisor action", error });
    }
  }
}

export const workflowStateController = new WorkflowStateController();
