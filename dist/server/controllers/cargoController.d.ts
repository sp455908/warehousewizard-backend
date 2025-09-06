import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class CargoController {
    createCargoDispatch(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCargoDispatches(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCargoDispatchById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateCargoDispatch(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCargoByBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    approveCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    rejectCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    processCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    completeCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSubmittedCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getApprovedCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProcessingCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCompletedCargo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const cargoController: CargoController;
//# sourceMappingURL=cargoController.d.ts.map