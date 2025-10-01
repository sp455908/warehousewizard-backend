import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";

export class PanelDashboardController {
  // Get dashboard data for Customer Panel
  async getCustomerDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const customerId = user.id;

      // Get customer's quotes
      const quotes = await prisma.quote.findMany({
        where: { customerId },
        include: {
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Get customer's bookings
      const bookings = await prisma.booking.findMany({
        where: { customerId },
        include: {
          warehouse: { select: { name: true, location: true } },
          quote: { select: { storageType: true, requiredSpace: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      res.json({
        role: "customer",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [], // Temporarily empty until Prisma client is regenerated
          recentQuotes: quotes,
          recentBookings: bookings,
          workflowHistory: [], // Temporarily empty until Prisma client is regenerated
          stats: {
            totalQuotes: quotes.length,
            pendingQuotes: quotes.filter(q => q.status === "pending" || q.status === "customer_confirmation_pending").length,
            confirmedBookings: bookings.filter(b => b.status === "confirmed").length,
            activeBookings: bookings.filter(b => b.status === "active").length
          }
        }
      });
    } catch (error) {
      console.error("Error in getCustomerDashboard:", error);
      return res.status(500).json({ message: "Failed to get customer dashboard", error });
    }
  }

  // Get dashboard data for Purchase Support Panel
  async getPurchaseDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;

      // Get all quotes for purchase support
      const quotes = await prisma.quote.findMany({
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
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      // Get all bookings
      const bookings = await prisma.booking.findMany({
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } },
          quote: { select: { storageType: true, requiredSpace: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      res.json({
        role: "purchase_support",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [], // Temporarily empty until Prisma client is regenerated
          recentQuotes: quotes,
          recentBookings: bookings,
          workflowHistory: [], // Temporarily empty until Prisma client is regenerated
          stats: {
            totalQuotes: quotes.length,
            pendingQuotes: quotes.filter(q => q.status === "pending" || q.status === "warehouse_quote_requested").length,
            confirmedBookings: bookings.filter(b => b.status === "confirmed").length,
            activeBookings: bookings.filter(b => b.status === "active").length
          }
        }
      });
    } catch (error) {
      console.error("Error in getPurchaseDashboard:", error);
      return res.status(500).json({ message: "Failed to get purchase dashboard", error });
    }
  }

  // Get dashboard data for Sales Support Panel
  async getSalesDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;

      // Get quotes assigned to sales
      const quotes = await prisma.quote.findMany({
        where: {
          assignedTo: user.id,
          status: { in: [
            "processing",
            "quoted",
            "customer_confirmation_pending",
            "booking_confirmed",
            "rejected"
          ] }
        },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true, city: true, state: true } },
          assignedToUser: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      res.json({
        role: "sales_support",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [], // Temporarily empty until Prisma client is regenerated
          recentQuotes: quotes,
          recentBookings: [],
          workflowHistory: [], // Temporarily empty until Prisma client is regenerated
          stats: {
            totalQuotes: quotes.length,
            pendingQuotes: quotes.filter(q => q.status === "processing" || q.status === "quoted").length,
            confirmedBookings: 0,
            activeBookings: 0
          }
        }
      });
    } catch (error) {
      console.error("Error in getSalesDashboard:", error);
      return res.status(500).json({ message: "Failed to get sales dashboard", error });
    }
  }

  // Get dashboard data for Supervisor Panel
  async getSupervisorDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;

      let bookings: any[] = [];
      try {
        bookings = await prisma.booking.findMany({
          include: {
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } },
            quote: { select: { storageType: true, requiredSpace: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        });
      } catch (prismaError) {
        // In local/dev environments without full schema/data, serve a graceful empty dashboard
        console.error("Prisma error in getSupervisorDashboard (serving empty dashboard):", prismaError);
        bookings = [];
      }

      res.json({
        role: "supervisor",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [],
          recentQuotes: [],
          recentBookings: bookings,
          workflowHistory: [],
          stats: {
            totalQuotes: 0,
            pendingQuotes: 0,
            confirmedBookings: bookings.filter(b => b.status === "confirmed").length,
            activeBookings: bookings.filter(b => b.status === "active").length
          }
        }
      });
    } catch (error) {
      console.error("Error in getSupervisorDashboard:", error);
      // As a last resort, return a minimal but valid payload to avoid breaking the UI
      const user = (req as any).user || {};
      return res.json({
        role: "supervisor",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [],
          recentQuotes: [],
          recentBookings: [],
          workflowHistory: [],
          stats: {
            totalQuotes: 0,
            pendingQuotes: 0,
            confirmedBookings: 0,
            activeBookings: 0
          }
        }
      });
    }
  }

  // Get dashboard data for Warehouse Panel
  async getWarehouseDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;

      // Get bookings for warehouse
      const bookings = await prisma.booking.findMany({
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, company: true } },
          warehouse: { select: { name: true, location: true } },
          quote: { select: { storageType: true, requiredSpace: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      res.json({
        role: "warehouse",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        dashboard: {
          pendingActions: [], // Temporarily empty until Prisma client is regenerated
          recentQuotes: [],
          recentBookings: bookings,
          workflowHistory: [], // Temporarily empty until Prisma client is regenerated
          stats: {
            totalQuotes: 0,
            pendingQuotes: 0,
            confirmedBookings: bookings.filter(b => b.status === "confirmed").length,
            activeBookings: bookings.filter(b => b.status === "active").length
          }
        }
      });
    } catch (error) {
      console.error("Error in getWarehouseDashboard:", error);
      return res.status(500).json({ message: "Failed to get warehouse dashboard", error });
    }
  }

  // Get role-specific dashboard data
  async getRoleDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      const { role } = user;

      switch (role) {
        case "customer":
          return this.getCustomerDashboard(req, res);
        case "purchase_support":
          return this.getPurchaseDashboard(req, res);
        case "sales_support":
          return this.getSalesDashboard(req, res);
        case "supervisor":
          return this.getSupervisorDashboard(req, res);
        case "warehouse":
          return this.getWarehouseDashboard(req, res);
        default:
          return res.status(400).json({ message: "Invalid role" });
      }
    } catch (error) {
      console.error("Error in getRoleDashboard:", error);
      return res.status(500).json({ message: "Failed to get role dashboard", error });
    }
  }
}

export const panelDashboardController = new PanelDashboardController();