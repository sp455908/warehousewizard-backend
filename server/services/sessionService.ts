import { prisma } from "../config/prisma";

const IDLE_TIMEOUT_MINUTES = 30;
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;

export const sessionService = {
  async createSession({ userId, token, userAgent, ipAddress, expiresAt }: any) {
    const now = new Date();
    const fallbackExpiry = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const p: any = prisma as any;
    return p.session.create({
      data: {
        userId,
        token,
        userAgent,
        ipAddress,
        expiresAt: expiresAt ?? fallbackExpiry,
        lastSeen: now,
        isActive: true,
      },
    });
  },

  async findActiveSessionsByUser(userId: string) {
    const p: any = prisma as any;
    return p.session.findMany({ where: { userId, isActive: true } });
  },

  async findSessionByToken(token: string) {
    const p: any = prisma as any;
    return p.session.findUnique({ where: { token } });
  },

  async updateLastSeen(sessionId: string) {
    const now = new Date();
    const nextExpiry = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const p: any = prisma as any;
    return p.session.update({
      where: { id: sessionId },
      data: { lastSeen: now, expiresAt: nextExpiry },
    });
  },

  async killSessionById(sessionId: string) {
    const p: any = prisma as any;
    return p.session.update({ where: { id: sessionId }, data: { isActive: false } });
  },

  async killSessionsByUser(userId: string) {
    const p: any = prisma as any;
    return p.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
  },
};
