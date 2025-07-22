import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.issues });
      }
      return res.status(500).json({ message: "Validation failed", error });
    }
  };
}

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Query validation failed",
          errors: error.issues,
        });
      }
      return next(error);
    }
  };
};