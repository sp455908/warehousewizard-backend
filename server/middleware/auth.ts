import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { sessionService } from "../services/sessionService";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader && authHeader.split(" ")[1];
  const cookieToken = (req as any).cookies?.["auth_token"] as string | undefined;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    // Verify session is active (if we persist sessions)
    try {
      const sess: any = await sessionService.findSessionByToken(token);
      if (!sess || !sess.isActive) {
        return res.status(401).json({ message: "Session inactive or invalid" });
      }

      const now = Date.now();
      const lastSeen = sess.lastSeen ? new Date(sess.lastSeen).getTime() : 0;
      if (lastSeen && now - lastSeen > IDLE_TIMEOUT_MS) {
        await sessionService.killSessionById(sess.id);
        return res.status(401).json({ message: "Session expired due to inactivity" });
      }

      if (sess.expiresAt && new Date(sess.expiresAt).getTime() < now) {
        await sessionService.killSessionById(sess.id);
        return res.status(401).json({ message: "Session expired" });
      }

      await sessionService.updateLastSeen(sess.id);
    } catch (err) {
      console.debug("Session check skipped or failed:", err);
    }
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
};

export const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
};