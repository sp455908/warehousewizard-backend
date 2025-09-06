import { Request, Response, NextFunction } from "express";
import { z } from "zod";
export declare function validateRequest(schema: any): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validateQuery: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=validation.d.ts.map