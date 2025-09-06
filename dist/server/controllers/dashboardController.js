"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const prisma_1 = require("../config/prisma");
const db = prisma_1.prisma;
class DashboardController {
    async getDashboardStats(req, res) {
        try {
            const user = req.user;
            let stats = {};
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch dashboard stats", error });
        }
    }
    async getCustomerDashboard(req, res) {
        try {
            const customerId = req.user.id || req.user._id?.toString();
            const [quotes, bookings, invoices] = await Promise.all([
                prisma_1.prisma.quote.findMany({
                    where: { customerId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.booking.findMany({
                    where: { customerId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.invoice.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch customer dashboard", error });
        }
    }
    async getPurchaseSupportDashboard(req, res) {
        try {
            const [pendingQuotes, processingQuotes, guestCustomers] = await Promise.all([
                prisma_1.prisma.quote.findMany({
                    where: { status: "pending" },
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.quote.findMany({
                    where: { status: "processing" },
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.user.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch purchase support dashboard", error });
        }
    }
    async getSalesSupportDashboard(req, res) {
        try {
            const [quotedQuotes, assignedWarehouses] = await Promise.all([
                prisma_1.prisma.quote.findMany({
                    where: { status: "quoted" },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                        warehouse: { select: { name: true, location: true } }
                    }
                }),
                prisma_1.prisma.quote.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch sales support dashboard", error });
        }
    }
    async getWarehouseDashboard(req, res) {
        try {
            const warehouseId = req.user.id || req.user._id?.toString();
            const [assignedQuotes, confirmedBookings] = await Promise.all([
                prisma_1.prisma.quote.findMany({
                    where: { assignedTo: warehouseId },
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.booking.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch warehouse dashboard", error });
        }
    }
    async getSupervisorDashboard(req, res) {
        try {
            const [confirmedBookings, pendingApprovals] = await Promise.all([
                prisma_1.prisma.booking.findMany({
                    where: { status: "confirmed" },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
                        warehouse: { select: { name: true, location: true } }
                    }
                }),
                prisma_1.prisma.quote.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch supervisor dashboard", error });
        }
    }
    async getAccountsDashboard(req, res) {
        try {
            const [pendingInvoices, paidInvoices, overdueInvoices] = await Promise.all([
                prisma_1.prisma.invoice.findMany({
                    where: { status: "sent" },
                    orderBy: { createdAt: 'desc' },
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.invoice.findMany({
                    where: { status: "paid" },
                    orderBy: { paidAt: 'desc' },
                    take: 10,
                    include: { customer: { select: { firstName: true, lastName: true, email: true, company: true } } }
                }),
                prisma_1.prisma.invoice.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch accounts dashboard", error });
        }
    }
    async getAdminDashboard(req, res) {
        try {
            const [recentUsers, systemStats] = await Promise.all([
                prisma_1.prisma.user.findMany({
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
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch admin dashboard", error });
        }
    }
    async getRecentActivities(req, res) {
        try {
            const user = req.user;
            let activities = [];
            if (user.role === "customer") {
                const quotes = await prisma_1.prisma.quote.findMany({
                    where: { customerId: user.id || user._id?.toString() },
                    orderBy: { updatedAt: 'desc' },
                    take: 5
                });
                activities = quotes.map((quote) => ({
                    type: "quote",
                    action: `Quote ${quote.status}`,
                    timestamp: quote.updatedAt,
                    details: `Quote for ${quote.storageType} storage`
                }));
            }
            res.json(activities);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch activities", error });
        }
    }
    async getQuoteAnalytics(req, res) {
        try {
            const analytics = await prisma_1.prisma.quote.groupBy({
                by: ['status'],
                _count: { status: true },
                _avg: { finalPrice: true }
            });
            const formattedAnalytics = analytics.map((item) => ({
                _id: item.status,
                count: item._count.status,
                avgPrice: item._avg.finalPrice
            }));
            res.json(formattedAnalytics);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch quote analytics", error });
        }
    }
    async getBookingAnalytics(req, res) {
        try {
            const analytics = await prisma_1.prisma.booking.groupBy({
                by: ['status'],
                _count: { status: true },
                _sum: { totalAmount: true }
            });
            const formattedAnalytics = analytics.map((item) => ({
                _id: item.status,
                count: item._count.status,
                totalAmount: item._sum.totalAmount
            }));
            res.json(formattedAnalytics);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch booking analytics", error });
        }
    }
    async getRevenueAnalytics(req, res) {
        try {
            const paidInvoices = await prisma_1.prisma.invoice.findMany({
                where: { status: "paid" },
                select: { amount: true, paidAt: true }
            });
            const revenueByMonth = paidInvoices.reduce((acc, invoice) => {
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
            const formattedRevenue = Object.entries(revenueByMonth).map(([key, value]) => {
                const [year, month] = key.split('-');
                return {
                    _id: { year: parseInt(year), month: parseInt(month) },
                    totalRevenue: value.totalRevenue,
                    count: value.count
                };
            }).sort((a, b) => b._id.year - a._id.year || b._id.month - a._id.month);
            res.json(formattedRevenue);
            return;
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch revenue analytics", error });
        }
    }
    async getCustomerStats(customerId) {
        const [quotesCount, bookingsCount, activeBookings, totalSpentResult] = await Promise.all([
            prisma_1.prisma.quote.count({ where: { customerId } }),
            prisma_1.prisma.booking.count({ where: { customerId } }),
            prisma_1.prisma.booking.count({ where: { customerId, status: "active" } }),
            prisma_1.prisma.invoice.aggregate({
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
            prisma_1.prisma.quote.count({ where: { status: "pending" } }),
            prisma_1.prisma.quote.count({ where: { status: "processing" } }),
            prisma_1.prisma.user.count({ where: { role: "customer", isActive: false } })
        ]);
        return {
            pendingQuotes,
            processingQuotes,
            guestCustomers
        };
    }
    async getSalesSupportStats() {
        const [quotedQuotes, approvedQuotes, rejectedQuotes] = await Promise.all([
            prisma_1.prisma.quote.count({ where: { status: "quoted" } }),
            prisma_1.prisma.quote.count({ where: { status: "approved" } }),
            prisma_1.prisma.quote.count({ where: { status: "rejected" } })
        ]);
        return {
            quotedQuotes,
            approvedQuotes,
            rejectedQuotes
        };
    }
    async getWarehouseStats(warehouseId) {
        const [assignedQuotes, confirmedBookings, activeBookings] = await Promise.all([
            prisma_1.prisma.quote.count({ where: { assignedTo: warehouseId } }),
            prisma_1.prisma.booking.count({ where: { status: "confirmed" } }),
            prisma_1.prisma.booking.count({ where: { status: "active" } })
        ]);
        return {
            assignedQuotes,
            confirmedBookings,
            activeBookings
        };
    }
    async getSupervisorStats() {
        const [pendingApprovals, confirmedBookings, completedBookings] = await Promise.all([
            prisma_1.prisma.quote.count({ where: { status: "quoted" } }),
            prisma_1.prisma.booking.count({ where: { status: "confirmed" } }),
            prisma_1.prisma.booking.count({ where: { status: "completed" } })
        ]);
        return {
            pendingApprovals,
            confirmedBookings,
            completedBookings
        };
    }
    async getAccountsStats() {
        const [pendingInvoices, paidInvoices, overdueInvoices, totalRevenueResult] = await Promise.all([
            prisma_1.prisma.invoice.count({ where: { status: "sent" } }),
            prisma_1.prisma.invoice.count({ where: { status: "paid" } }),
            prisma_1.prisma.invoice.count({ where: { status: "overdue" } }),
            prisma_1.prisma.invoice.aggregate({
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
            prisma_1.prisma.user.count({ where: { isActive: true } }),
            prisma_1.prisma.warehouse.count({ where: { isActive: true } }),
            prisma_1.prisma.quote.count(),
            prisma_1.prisma.booking.count()
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
            prisma_1.prisma.user.groupBy({
                by: ['role'],
                _count: { role: true }
            }),
            prisma_1.prisma.warehouse.groupBy({
                by: ['storageType'],
                _count: { storageType: true }
            })
        ]);
        const formattedUsersByRole = usersByRole.map((item) => ({
            _id: item.role,
            count: item._count.role
        }));
        const formattedWarehousesByType = warehousesByType.map((item) => ({
            _id: item.storageType,
            count: item._count.storageType
        }));
        return {
            usersByRole: formattedUsersByRole,
            warehousesByType: formattedWarehousesByType
        };
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
//# sourceMappingURL=dashboardController.js.map