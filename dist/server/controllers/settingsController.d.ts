import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare const settingsController: {
    getGeneralSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    updateGeneralSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getSecuritySettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    updateSecuritySettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getEmailSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    updateEmailSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    testEmailConfig(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getAllSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    resetSettingsToDefault(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    exportSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    importSettings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
};
//# sourceMappingURL=settingsController.d.ts.map