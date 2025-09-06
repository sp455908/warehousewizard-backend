import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class DeliveryController {
    createDeliveryRequest(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDeliveryRequests(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDeliveryRequestById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateDeliveryRequest(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    scheduleDelivery(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    assignDriver(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    dispatchDelivery(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    completeDelivery(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    trackDelivery(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getRequestedDeliveries(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getScheduledDeliveries(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getInTransitDeliveries(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDeliveredDeliveries(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private generateTrackingNumber;
}
export declare const deliveryController: DeliveryController;
//# sourceMappingURL=deliveryController.d.ts.map