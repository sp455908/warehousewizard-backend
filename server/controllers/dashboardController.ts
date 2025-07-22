import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { QuoteModel, BookingModel, UserModel, WarehouseModel, InvoiceModel } from "../../shared/schema";

export class DashboardController {
  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      
      let stats: any = {};

      switch (user.role) {
        case "customer":
          stats = await this.getCustomerStats(user._id.toString());
          break;
        case "purchase_support":
          stats = await this.getPurchaseSupportStats();
          break;
        case "sales_support":
          stats = await this.getSalesSupportStats();
          break;
        case "warehouse":
          stats = await this.getWarehouseStats(user._id.toString());
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
      const customerId = req.user!._id.toString();
      
      const [quotes, bookings, invoices] = await Promise.all([
        QuoteModel.find({ customerId }).sort({ createdAt: -1 }).limit(5),
        BookingModel.find({ customerId }).sort({ createdAt: -1 }).limit(5),
        InvoiceModel.find({ customerId }).sort({ createdAt: -1 }).limit(5)
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
        QuoteModel.find({ status: "pending" }).populate('customerId', 'firstName lastName email company').sort({ createdAt: -1 }),
        QuoteModel.find({ status: "processing" }).populate('customerId', 'firstName lastName email company').sort({ createdAt: -1 }),
        UserModel.find({ role: "customer", isActive: false }).sort({ createdAt: -1 })
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
        QuoteModel.find({ status: "quoted" })
          .populate('customerId', 'firstName lastName email company')
          .populate('warehouseId', 'name location')
          .sort({ createdAt: -1 }),
        QuoteModel.find({ status: "processing", assignedTo: { $exists: true } })
          .populate('customerId', 'firstName lastName email company')
          .populate('assignedTo', 'firstName lastName email')
          .sort({ createdAt: -1 })
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
      const warehouseId = req.user!._id.toString();
      
      const [assignedQuotes, confirmedBookings] = await Promise.all([
        QuoteModel.find({ assignedTo: warehouseId })
          .populate('customerId', 'firstName lastName email company')
          .sort({ createdAt: -1 }),
        BookingModel.find({ status: "confirmed" })
          .populate('customerId', 'firstName lastName email company')
          .populate('warehouseId', 'name location')
          .sort({ createdAt: -1 })
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
        BookingModel.find({ status: "confirmed" })
          .populate('customerId', 'firstName lastName email company')
          .populate('warehouseId', 'name location')
          .sort({ createdAt: -1 }),
        QuoteModel.find({ status: "quoted" })
          .populate('customerId', 'firstName lastName email company')
          .sort({ createdAt: -1 })
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
        InvoiceModel.find({ status: "sent" })
          .populate('customerId', 'firstName lastName email company')
          .sort({ createdAt: -1 }),
        InvoiceModel.find({ status: "paid" })
          .populate('customerId', 'firstName lastName email company')
          .sort({ paidAt: -1 })
          .limit(10),
        InvoiceModel.find({ status: "overdue" })
          .populate('customerId', 'firstName lastName email company')
          .sort({ dueDate: 1 })
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
        UserModel.find().sort({ createdAt: -1 }).limit(10),
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
      const user = req.user!;
      let activities: any[] = [];

      // Get recent activities based on user role
      if (user.role === "customer") {
        const quotes = await QuoteModel.find({ customerId: user._id })
          .sort({ updatedAt: -1 })
          .limit(5);
        activities = quotes.map(quote => ({
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
      const analytics = await QuoteModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            avgPrice: { $avg: "$finalPrice" }
          }
        }
      ]);

      res.json(analytics);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch quote analytics", error });
    }
  }

  async getBookingAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const analytics = await BookingModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" }
          }
        }
      ]);

      res.json(analytics);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch booking analytics", error });
    }
  }

  async getRevenueAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const revenue = await InvoiceModel.aggregate([
        {
          $match: { status: "paid" }
        },
        {
          $group: {
            _id: {
              year: { $year: "$paidAt" },
              month: { $month: "$paidAt" }
            },
            totalRevenue: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { "_id.year": -1, "_id.month": -1 }
        }
      ]);

      res.json(revenue);
      return;
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch revenue analytics", error });
    }
  }

  // Helper methods for stats calculation
  private async getCustomerStats(customerId: string) {
    const [quotesCount, bookingsCount, activeBookings, totalSpent] = await Promise.all([
      QuoteModel.countDocuments({ customerId }),
      BookingModel.countDocuments({ customerId }),
      BookingModel.countDocuments({ customerId, status: "active" }),
      InvoiceModel.aggregate([
        { $match: { customerId: customerId, status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    return {
      totalQuotes: quotesCount,
      totalBookings: bookingsCount,
      activeBookings,
      totalSpent: totalSpent[0]?.total || 0
    };
  }

  private async getPurchaseSupportStats() {
    const [pendingQuotes, processingQuotes, guestCustomers] = await Promise.all([
      QuoteModel.countDocuments({ status: "pending" }),
      QuoteModel.countDocuments({ status: "processing" }),
      UserModel.countDocuments({ role: "customer", isActive: false })
    ]);

    return {
      pendingQuotes,
      processingQuotes,
      guestCustomers
    };
  }

  private async getSalesSupportStats() {
    const [quotedQuotes, approvedQuotes, rejectedQuotes] = await Promise.all([
      QuoteModel.countDocuments({ status: "quoted" }),
      QuoteModel.countDocuments({ status: "approved" }),
      QuoteModel.countDocuments({ status: "rejected" })
    ]);

    return {
      quotedQuotes,
      approvedQuotes,
      rejectedQuotes
    };
  }

  private async getWarehouseStats(warehouseId: string) {
    const [assignedQuotes, confirmedBookings, activeBookings] = await Promise.all([
      QuoteModel.countDocuments({ assignedTo: warehouseId }),
      BookingModel.countDocuments({ status: "confirmed" }),
      BookingModel.countDocuments({ status: "active" })
    ]);

    return {
      assignedQuotes,
      confirmedBookings,
      activeBookings
    };
  }

  private async getSupervisorStats() {
    const [pendingApprovals, confirmedBookings, completedBookings] = await Promise.all([
      QuoteModel.countDocuments({ status: "quoted" }),
      BookingModel.countDocuments({ status: "confirmed" }),
      BookingModel.countDocuments({ status: "completed" })
    ]);

    return {
      pendingApprovals,
      confirmedBookings,
      completedBookings
    };
  }

  private async getAccountsStats() {
    const [pendingInvoices, paidInvoices, overdueInvoices, totalRevenue] = await Promise.all([
      InvoiceModel.countDocuments({ status: "sent" }),
      InvoiceModel.countDocuments({ status: "paid" }),
      InvoiceModel.countDocuments({ status: "overdue" }),
      InvoiceModel.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    return {
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue: totalRevenue[0]?.total || 0
    };
  }

  private async getAdminStats() {
    const [totalUsers, totalWarehouses, totalQuotes, totalBookings] = await Promise.all([
      UserModel.countDocuments({ isActive: true }),
      WarehouseModel.countDocuments({ isActive: true }),
      QuoteModel.countDocuments(),
      BookingModel.countDocuments()
    ]);

    return {
      totalUsers,
      totalWarehouses,
      totalQuotes,
      totalBookings
    };
  }

  private async getSystemStats() {
    const usersByRole = await UserModel.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    const warehousesByType = await WarehouseModel.aggregate([
      { $group: { _id: "$storageType", count: { $sum: 1 } } }
    ]);

    return {
      usersByRole,
      warehousesByType
    };
  }
}

export const dashboardController = new DashboardController();