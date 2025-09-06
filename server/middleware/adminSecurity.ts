import { Request, Response, NextFunction } from "express";

/**
 * Security middleware to prevent admin role creation/assignment
 * This adds an extra layer of protection beyond application-level checks
 */
export function preventAdminRoleCreation(req: Request, res: Response, next: NextFunction) {
  // Check if request body contains admin role
  if (req.body && req.body.role === "admin") {
    console.warn("🚨 SECURITY ALERT: Admin role detected in request body");
    console.warn("Request body:", JSON.stringify(req.body, null, 2));
    console.warn("IP Address:", req.ip);
    console.warn("User Agent:", req.get("User-Agent"));
    
    return res.status(403).json({
      message: "Admin role creation is not allowed through this endpoint",
      error: "FORBIDDEN_ADMIN_ROLE"
    });
  }

  // Check if request body contains role update to admin
  if (req.body && req.body.role && req.body.role === "admin") {
    console.warn("🚨 SECURITY ALERT: Admin role assignment detected in request body");
    console.warn("Request body:", JSON.stringify(req.body, null, 2));
    console.warn("IP Address:", req.ip);
    console.warn("User Agent:", req.get("User-Agent"));
    
    return res.status(403).json({
      message: "Admin role assignment is not allowed through this endpoint",
      error: "FORBIDDEN_ADMIN_ROLE_ASSIGNMENT"
    });
  }

  next();
}

/**
 * Middleware to log all admin-related attempts
 */
export function logAdminAttempts(req: Request, res: Response, next: NextFunction) {
  const adminKeywords = ["admin", "administrator", "superuser"];
  const bodyString = JSON.stringify(req.body).toLowerCase();
  
  if (adminKeywords.some(keyword => bodyString.includes(keyword))) {
    console.warn("🔍 ADMIN-RELATED REQUEST DETECTED:");
    console.warn("Method:", req.method);
    console.warn("URL:", req.url);
    console.warn("Body:", JSON.stringify(req.body, null, 2));
    console.warn("IP:", req.ip);
    console.warn("User-Agent:", req.get("User-Agent"));
    console.warn("Timestamp:", new Date().toISOString());
  }
  
  next();
}