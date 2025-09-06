import { Request, Response, NextFunction } from "express";
export interface AuthenticatedRequest extends Request {
    user?: any;
}
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const authorizeRoles: (...roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const generateToken: (userId: string) => string;
//# sourceMappingURL=auth.d.ts.map