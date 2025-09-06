import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class UserController {
    getProfile(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateProfile(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    changePassword(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAllUsers(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUsersByRole(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    activateUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deactivateUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    verifyGuestCustomer(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPendingGuestCustomers(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getRoles(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const userController: UserController;
//# sourceMappingURL=userController.d.ts.map