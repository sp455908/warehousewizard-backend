import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";

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
      const [confirmedBookings, pendingApprovals] = await Promise.all([
        prisma.booking.findMany({ 
          where: { status: "confirmed" },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: { select: { firstName: true, lastName: true, email: true, company: true } },
            warehouse: { select: { name: true, location: true } }
          }
        }),
        prisma.quote.findMany({ 
          where: { status: "quoted" },
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
        })
      ]);

      const stats = await this.getSupervisorStats();

      res.json({
        stats,
        confirmedBookings,
        pendingApprovals,
      });
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch supervisor dashboard", error });
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
      const [recentUsers, systemStats] = await Promise.all([
        prisma.user.findMany({ 
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true }
        }),
        this.getSystemStats()
      ]);

      const stats = await this.getAdminStats();

      res.json({
        stats,
        recentUsers,
        systemStats,
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
  private async getCustomerStats(customerId: string) {
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

  private async getPurchaseSupportStats() {
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

  private async getSalesSupportStats() {
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

  private async getWarehouseStats(warehouseId: string) {
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

  private async getSupervisorStats() {
    const [pendingApprovals, confirmedBookings, completedBookings] = await Promise.all([
      prisma.quote.count({ where: { status: "quoted" } }),
      prisma.booking.count({ where: { status: "confirmed" } }),
      prisma.booking.count({ where: { status: "completed" } })
    ]);

    return {
      pendingApprovals,
      confirmedBookings,
      completedBookings
    };
  }

  private async getAccountsStats() {
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

  private async getAdminStats() {
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

  private async getSystemStats() {
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
}

export const dashboardController = new DashboardController();