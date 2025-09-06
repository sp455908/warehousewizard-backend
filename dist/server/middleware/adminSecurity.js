"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventAdminRoleCreation = preventAdminRoleCreation;
exports.logAdminAttempts = logAdminAttempts;
function preventAdminRoleCreation(req, res, next) {
    if (req.body && typeof req.body === 'object' && req.body.role === "admin") {
        console.warn("🚨 SECURITY ALERT: Admin role detected in request body");
        console.warn("Request body:", JSON.stringify(req.body, null, 2));
        console.warn("IP Address:", req.ip);
        console.warn("User Agent:", req.get("User-Agent"));
        return res.status(403).json({
            message: "Admin role creation/assignment is not allowed through this endpoint",
            error: "FORBIDDEN_ADMIN_ROLE"
        });
    }
    return next();
}
function logAdminAttempts(req, res, next) {
    const adminKeywords = ["admin", "administrator", "superuser"];
    const bodyString = req.body ? JSON.stringify(req.body).toLowerCase() : "";
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
//# sourceMappingURL=adminSecurity.js.map