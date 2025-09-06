import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class InvoiceController {
    createInvoice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getInvoices(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getInvoiceById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateInvoice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteInvoice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    sendInvoice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    markAsPaid(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    markAsOverdue(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    payInvoice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    generateInvoicePDF(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDraftInvoices(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSentInvoices(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPaidInvoices(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getOverdueInvoices(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private generateInvoiceNumber;
}
export declare const invoiceController: InvoiceController;
//# sourceMappingURL=invoiceController.d.ts.map