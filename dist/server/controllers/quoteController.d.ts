import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class QuoteController {
    createQuote(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuotes(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuoteById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateQuote(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    assignQuote(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    approveQuote(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    rejectQuote(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuotesForRole(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    calculateQuotePrice(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPendingQuotes(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProcessingQuotes(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuotedQuotes(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private getQuotesByCustomer;
    private getQuotesByStatus;
    private getQuotesByAssignee;
    private getQuotesForRoleInternal;
    private searchQuotes;
}
export declare const quoteController: QuoteController;
//# sourceMappingURL=quoteController.d.ts.map