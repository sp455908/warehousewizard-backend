import { Request, Response } from "express";
export declare class WarehouseController {
    getAllWarehouses(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWarehouseById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchWarehouses(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createWarehouse(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateWarehouse(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteWarehouse(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWarehousesByType(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWarehousesByLocation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkAvailability(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getWarehouseTypes(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const warehouseController: WarehouseController;
//# sourceMappingURL=warehouseController.d.ts.map