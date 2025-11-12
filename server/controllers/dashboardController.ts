import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { QuoteStatus } from "@prisma/client";

const db: any = prisma;

export class DashboardController {
  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      
      let stats: any = {};

      switch (user.role) {
        case "customer":
          stats = await this.getCustomerStats(user.id || user._id?.toString());
          break;
        case "purchase_support":
          stats = await this.getPurchaseSupportStats();
          break;
        case "sales_support":
          stats = await this.getSalesSupportStats();
          break;
        case "warehouse":
          stats = await this.getWarehouseStats(user.id || user._id?.toString());
          break;
        case "supervisor":
          stats = await this.getSupervisorStats();
          break;
        case "accounts":
          stats = await this.getAccountsStats();
          break;
        case "admin":
          stats = await this.getAdminStats();
          break;
        default:
          stats = { message: "No stats available for this role" };
      }

      res.json(stats);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch dashboard stats", error });
    }
  }

  async getCustomerDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = (req.user! as any).id || (req.user! as any)._id?.toString();
      
      const [quotes, bookings, invoices] = await Promise.all([
        prisma.quote.findMany({ 
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.booking.findMany({ 
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.invoice.findMany({ 
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        })
      ]);

      const stats = await this.getCustomerStats(customerId);

      res.json({
        stats,
        recentQuotes: quotes,
        recentBookings: bookings,
        recentInvoices: invoices,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch customer dashboard", error });
    }
  }

  async getPurchaseSupportDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const [pendingQuotes, processingQuotes, guestCustomers] = await Promise.all([
        prisma.quote.findMany({ 
          where: { status: "pending" },
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.quote.findMany({ 
          where: { status: "processing" },
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.user.findMany({ 
          where: { role: "customer", isActive: false },
          orderBy: { createdAt: 'desc' },
          select: { id: true, firstName: true, lastName: true, email: true, company: true, createdAt: true }
        })
      ]);

      const stats = await this.getPurchaseSupportStats();

      res.json({
        stats,
        pendingQuotes,
        processingQuotes,
        guestCustomers,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch purchase support dashboard", error });
    }
  }

  async getSalesSupportDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const [quotedQuotes, assignedWarehouses] = await Promise.all([
        prisma.quote.findMany({ 
          where: { status: "quoted" },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } }
          }
        }),
        prisma.quote.findMany({ 
          where: { status: "processing", assignedTo: { not: null } },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            assignedToUser: { select: { firstName: true, lastName: true, email: true } }
          }
        })
      ]);

      const stats = await this.getSalesSupportStats();

      res.json({
        stats,
        quotedQuotes,
        assignedWarehouses,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch sales support dashboard", error });
    }
  }

  async getWarehouseDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const warehouseId = (req.user! as any).id || (req.user! as any)._id?.toString();
      
      const [assignedQuotes, confirmedBookings] = await Promise.all([
        prisma.quote.findMany({ 
          where: { assignedTo: warehouseId },
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.booking.findMany({ 
          where: { status: "confirmed" },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } }
          }
        })
      ]);

      const stats = await this.getWarehouseStats(warehouseId);

      res.json({
        stats,
        assignedQuotes,
        confirmedBookings,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch warehouse dashboard", error });
    }
  }

  async getSupervisorDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("[DEBUG] Fetching supervisor dashboard data...");
      
      // First, let's get all cargo dispatches with full relationships for CDD list
      const allCargoDispatches = await prisma.cargoDispatchDetail.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true, email: true, company: true } },
              warehouse: { select: { name: true, location: true } }
            }
          }
        }
      }).catch(error => {
        console.log("[DEBUG] Error fetching all cargo dispatches:", error);
        return [];
      });
      console.log("[DEBUG] All cargo dispatches:", allCargoDispatches.length);
      
      // Filter for pending cargo dispatches (submitted status)
      const pendingCargoDispatches = allCargoDispatches.filter(cargo => cargo.status === 'submitted');
      console.log("[DEBUG] Pending cargo dispatches:", pendingCargoDispatches.length);
      
      // Check if the booking exists for the cargo dispatch
      if (allCargoDispatches.length > 0) {
        const firstCargo = allCargoDispatches[0];
        console.log("[DEBUG] First cargo dispatch bookingId:", firstCargo.bookingId);
        
        const booking = await prisma.booking.findUnique({
          where: { id: firstCargo.bookingId }
        });
        console.log("[DEBUG] Booking exists:", !!booking);
        if (booking) {
          console.log("[DEBUG] Booking status:", booking.status);
        }
      }
      
      console.log("[DEBUG] Starting Promise.all queries...");
      
      const [confirmedBookings, pendingApprovals, pendingBookings] = await Promise.all([
        prisma.booking.findMany({ 
          where: { status: "confirmed" },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } }
          }
        }).catch(error => {
          console.log("[ERROR] Error fetching confirmed bookings:", error);
          return [];
        }),
        prisma.quote.findMany({ 
          where: { status: { in: ["supervisor_review_pending", "quoted", "customer_confirmation_pending", "customer_confirmed", "rate_confirmed", "approved", "booking_confirmed"] as QuoteStatus[] } },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } }
          }
        }).catch(error => {
          console.log("[ERROR] Error fetching pending approvals:", error);
          return [];
        }),
        // Step 7: Customer confirmed bookings that need supervisor approval (Step 8)
        prisma.booking.findMany({ 
          where: { status: "pending" },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } },
            quote: { select: { id: true, status: true } }
          }
        }).catch(error => {
          console.log("[ERROR] Error fetching pending bookings:", error);
          return [];
        })
      ]);
      
      console.log("[DEBUG] Promise.all queries completed successfully");

      const stats = await this.getSupervisorStats().catch(error => {
        console.log("[ERROR] Error fetching supervisor stats:", error);
        return {
          pendingApprovals: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          pendingCargoDispatches: 0
        };
      });

      console.log("[DEBUG] Supervisor dashboard data:", {
        confirmedBookings: confirmedBookings.length,
        pendingApprovals: pendingApprovals.length,
        pendingBookings: pendingBookings.length,
        pendingCargoDispatches: pendingCargoDispatches.length,
        allCargoDispatches: allCargoDispatches.length,
        stats
      });
      
      // Debug: Check specific rate_confirmed quotes
      const rateConfirmedQuotes = pendingApprovals.filter((q: any) => q.status === 'rate_confirmed');
      console.log("[DEBUG] Rate confirmed quotes found:", rateConfirmedQuotes.length);

      res.json({
        stats,
        confirmedBookings,
        pendingApprovals,
        pendingBookings, // Step 7 confirmations awaiting supervisor approval (Step 8)
        pendingCargoDispatches, // Step 11 CDD awaiting supervisor approval (Step 12) - filtered from allCargoDispatches
        allCargoDispatches, // All cargo dispatches for CDD list (all statuses)
      });
      return;
    } catch (error) {
      console.log("[ERROR] Supervisor dashboard error:", error);
      console.log("[ERROR] Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      return res.status(500).json({ 
        message: "Failed to fetch supervisor dashboard", 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  async getAccountsDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const [pendingInvoices, paidInvoices, overdueInvoices] = await Promise.all([
        prisma.invoice.findMany({ 
          where: { status: "sent" },
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.invoice.findMany({ 
          where: { status: "paid" },
          orderBy: { paidAt: 'desc' },
          take: 10,
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        }),
        prisma.invoice.findMany({ 
          where: { status: "overdue" },
          orderBy: { dueDate: 'asc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        })
      ]);

      const stats = await this.getAccountsStats();

      res.json({
        stats,
        pendingInvoices,
        paidInvoices,
        overdueInvoices,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch accounts dashboard", error });
    }
  }

  async getAdminDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const [recentUsers, systemStats, systemMetrics] = await Promise.all([
        prisma.user.findMany({ 
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true }
        }),
        this.getSystemStats(),
        this.getSystemMetrics()
      ]);

      const stats = await this.getAdminStats();

      res.json({
        stats,
        recentUsers,
        systemStats,
        systemMetrics,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch admin dashboard", error });
    }
  }

  async getRecentActivities(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user! as any;
      let activities: any[] = [];

      // Get recent activities based on user role
      if (user.role === "customer") {
        const quotes = await prisma.quote.findMany({ 
          where: { customerId: user.id || user._id?.toString() },
          orderBy: { updatedAt: 'desc' },
          take: 5
        });
        activities = quotes.map((quote: any) => ({
          type: "quote",
          action: `Quote ${quote.status}`,
          timestamp: quote.updatedAt,
          details: `Quote for ${quote.storageType} storage`
        }));
      }

      res.json(activities);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch activities", error });
    }
  }

  async getQuoteAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const analytics = await prisma.quote.groupBy({
        by: ['status'],
        _count: { status: true },
        _avg: { finalPrice: true }
      });

      const formattedAnalytics = analytics.map((item: any) => ({
        _id: item.status,
        count: item._count.status,
        avgPrice: item._avg.finalPrice
      }));

      res.json(formattedAnalytics);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quote analytics", error });
    }
  }

  async getBookingAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const analytics = await prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { totalAmount: true }
      });

      const formattedAnalytics = analytics.map((item: any) => ({
        _id: item.status,
        count: item._count.status,
        totalAmount: item._sum.totalAmount
      }));

      res.json(formattedAnalytics);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch booking analytics", error });
    }
  }

  async getRevenueAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      // Get paid invoices and group by month/year
      const paidInvoices = await prisma.invoice.findMany({
        where: { status: "paid" },
        select: { amount: true, paidAt: true }
      });

      // Group by month/year manually since Prisma doesn't have date grouping
      const revenueByMonth = paidInvoices.reduce((acc: any, invoice: any) => {
        if (invoice.paidAt) {
          const date = new Date(invoice.paidAt);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${month}`;
          
          if (!acc[key]) {
            acc[key] = { totalRevenue: 0, count: 0 };
          }
          acc[key].totalRevenue += invoice.amount;
          acc[key].count += 1;
        }
        return acc;
      }, {});

      const formattedRevenue = Object.entries(revenueByMonth).map(([key, value]: [string, any]) => {
        const [year, month] = key.split('-');
        return {
          _id: { year: parseInt(year), month: parseInt(month) },
          totalRevenue: value.totalRevenue,
          count: value.count
        };
      }).sort((a, b) => b._id.year - a._id.year || b._id.month - a._id.month);

      res.json(formattedRevenue);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch revenue analytics", error });
    }
  }

  // Helper methods for stats calculation
  async getCustomerStats(customerId: string) {
    const [quotesCount, bookingsCount, activeBookings, totalSpentResult] = await Promise.all([
      prisma.quote.count({ where: { customerId } }),
      prisma.booking.count({ where: { customerId } }),
      prisma.booking.count({ where: { customerId, status: "active" } }),
      prisma.invoice.aggregate({
        where: { customerId, status: "paid" },
        _sum: { amount: true }
      })
    ]);

    return {
      totalQuotes: quotesCount,
      totalBookings: bookingsCount,
      activeBookings,
      totalSpent: totalSpentResult._sum.amount || 0
    };
  }

  async getPurchaseSupportStats() {
    const [pendingQuotes, processingQuotes, guestCustomers] = await Promise.all([
      prisma.quote.count({ where: { status: "pending" } }),
      prisma.quote.count({ where: { status: "processing" } }),
      prisma.user.count({ where: { role: "customer", isActive: false } })
    ]);

    return {
      pendingQuotes,
      processingQuotes,
      guestCustomers
    };
  }

  async getSalesSupportStats() {
    const [quotedQuotes, approvedQuotes, rejectedQuotes] = await Promise.all([
      prisma.quote.count({ where: { status: "quoted" } }),
      prisma.quote.count({ where: { status: "approved" } }),
      prisma.quote.count({ where: { status: "rejected" } })
    ]);

    return {
      quotedQuotes,
      approvedQuotes,
      rejectedQuotes
    };
  }

  async getWarehouseStats(warehouseId: string) {
    const [assignedQuotes, confirmedBookings, activeBookings] = await Promise.all([
      prisma.quote.count({ where: { assignedTo: warehouseId } }),
      prisma.booking.count({ where: { status: "confirmed" } }),
      prisma.booking.count({ where: { status: "active" } })
    ]);

    return {
      assignedQuotes,
      confirmedBookings,
      activeBookings
    };
  }

  async getSupervisorStats() {
    const [pendingApprovals, confirmedBookings, completedBookings, pendingCargoDispatches] = await Promise.all([
      prisma.quote.count({ where: { status: { in: ["supervisor_review_pending", "quoted", "customer_confirmation_pending", "customer_confirmed"] as QuoteStatus[] } } }),
      prisma.booking.count({ where: { status: "confirmed" } }),
      prisma.booking.count({ where: { status: "completed" } }),
      prisma.cargoDispatchDetail.count({ where: { status: "submitted" } })
    ]);

    return {
      pendingApprovals,
      confirmedBookings,
      completedBookings,
      pendingCargoDispatches
    };
  }

  async getAccountsStats() {
    const [pendingInvoices, paidInvoices, overdueInvoices, totalRevenueResult] = await Promise.all([
      prisma.invoice.count({ where: { status: "sent" } }),
      prisma.invoice.count({ where: { status: "paid" } }),
      prisma.invoice.count({ where: { status: "overdue" } }),
      prisma.invoice.aggregate({
        where: { status: "paid" },
        _sum: { amount: true }
      })
    ]);

    return {
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue: totalRevenueResult._sum.amount || 0
    };
  }

  async getAdminStats() {
    const [totalUsers, totalWarehouses, totalQuotes, totalBookings] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.quote.count(),
      prisma.booking.count()
    ]);

    return {
      totalUsers,
      totalWarehouses,
      totalQuotes,
      totalBookings
    };
  }

  async getSystemStats() {
    const [usersByRole, warehousesByType] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      prisma.warehouse.groupBy({
        by: ['storageType'],
        _count: { storageType: true }
      })
    ]);

    const formattedUsersByRole = usersByRole.map((item: any) => ({
      _id: item.role,
      count: item._count.role
    }));

    const formattedWarehousesByType = warehousesByType.map((item: any) => ({
      _id: item.storageType,
      count: item._count.storageType
    }));

    return {
      usersByRole: formattedUsersByRole,
      warehousesByType: formattedWarehousesByType
    };
  }

  async getSystemMetrics() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Active Sessions (sessions active in last hour)
      const activeSessions = await prisma.session.count({
        where: {
          isActive: true,
          lastSeen: { gte: oneHourAgo }
        }
      });

      // System Health calculation (based on various metrics)
      const [totalUsers, activeUsers, totalWarehouses, activeWarehouses, totalQuotes, pendingQuotes, totalBookings, activeBookings] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.warehouse.count(),
        prisma.warehouse.count({ where: { isActive: true } }),
        prisma.quote.count(),
        prisma.quote.count({ where: { status: { in: ["pending", "processing"] as QuoteStatus[] } } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: { in: ["active", "confirmed"] } } })
      ]);

      // Calculate health score (0-100)
      const userHealth = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 100;
      const warehouseHealth = totalWarehouses > 0 ? (activeWarehouses / totalWarehouses) * 100 : 100;
      const quoteHealth = totalQuotes > 0 ? Math.max(0, 100 - (pendingQuotes / totalQuotes) * 50) : 100;
      const bookingHealth = totalBookings > 0 ? (activeBookings / totalBookings) * 50 : 50;
      
      const systemHealth = Math.round((userHealth * 0.3 + warehouseHealth * 0.3 + quoteHealth * 0.2 + bookingHealth * 0.2));

      // Data Storage (estimate based on records)
      const [userCount, quoteCount, bookingCount, invoiceCount] = await Promise.all([
        prisma.user.count(),
        prisma.quote.count(),
        prisma.booking.count(),
        prisma.invoice.count()
      ]);

      // Rough estimate: each record ~1KB average
      const estimatedDataKB = (userCount + quoteCount + bookingCount + invoiceCount) * 1;
      const estimatedDataMB = estimatedDataKB / 1024;
      const estimatedDataGB = estimatedDataMB / 1024;
      const estimatedDataTB = estimatedDataGB / 1024;
      const totalCapacityTB = 3.5; // Total capacity in TB
      const usedTB = Math.min(estimatedDataTB, totalCapacityTB);
      const storagePercentage = Math.round((usedTB / totalCapacityTB) * 100);

      // System Load (based on recent activity in last 24 hours)
      const [recentQuotes, recentBookings, recentUsers] = await Promise.all([
        prisma.quote.count({ where: { createdAt: { gte: oneDayAgo } } }),
        prisma.booking.count({ where: { createdAt: { gte: oneDayAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: oneDayAgo } } })
      ]);

      // Calculate load percentage (0-100)
      // Base load + activity factor
      const baseLoad = 10;
      const activityFactor = Math.min((recentQuotes * 2 + recentBookings * 3 + recentUsers * 1) / 10, 90);
      const systemLoad = Math.round(Math.min(baseLoad + activityFactor, 100));

      return {
        activeSessions,
        systemHealth,
        dataStorage: {
          percentage: storagePercentage,
          used: usedTB.toFixed(2),
          total: totalCapacityTB.toFixed(1),
          unit: "TB"
        },
        systemLoad
      };
    } catch (error) {
      console.error("Error calculating system metrics:", error);
      // Return default values on error
      return {
        activeSessions: 0,
        systemHealth: 100,
        dataStorage: {
          percentage: 0,
          used: "0",
          total: "3.5",
          unit: "TB"
        },
        systemLoad: 0
      };
    }
  }
}

export const dashboardController = new DashboardController();