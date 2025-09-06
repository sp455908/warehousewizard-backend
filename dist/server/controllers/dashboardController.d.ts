import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class DashboardController {
    getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCustomerDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPurchaseSupportDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSalesSupportDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWarehouseDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSupervisorDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAccountsDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAdminDashboard(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getRecentActivities(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuoteAnalytics(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getBookingAnalytics(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getRevenueAnalytics(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private getCustomerStats;
    private getPurchaseSupportStats;
    private getSalesSupportStats;
    private getWarehouseStats;
    private getSupervisorStats;
    private getAccountsStats;
    private getAdminStats;
    private getSystemStats;
}
export declare const dashboardController: DashboardController;
//# sourceMappingURL=dashboardController.d.ts.map