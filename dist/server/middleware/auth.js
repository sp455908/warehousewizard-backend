"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.authorizeRoles = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Access token required" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Invalid or inactive user" });
        }
        req.user = user;
        return next();
    }
    catch (error) {
        return res.status(403).json({ message: "Invalid token" });
    }
};
exports.authenticateToken = authenticateToken;
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Insufficient permissions" });
        }
        return next();
    };
};
exports.authorizeRoles = authorizeRoles;
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map