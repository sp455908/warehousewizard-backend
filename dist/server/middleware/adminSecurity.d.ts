import { Request, Response, NextFunction } from "express";
export declare function preventAdminRoleCreation(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function logAdminAttempts(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=adminSecurity.d.ts.map