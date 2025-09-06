import { Request, Response } from "express";
export declare class AuthController {
    register(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    forgotPassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    resetPassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    verifyEmail(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    resendVerification(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    createGuestUser(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const authController: AuthController;
//# sourceMappingURL=authController.d.ts.map