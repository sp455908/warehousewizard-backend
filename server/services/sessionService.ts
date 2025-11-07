import { prisma } from "../config/prisma";

export const sessionService = {
  async createSession({ userId, token, userAgent, ipAddress, expiresAt }: any) {
    const p: any = prisma as any;
    return p.session.create({
      data: { userId, token, userAgent, ipAddress, expiresAt, lastSeen: new Date(), isActive: true },
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

  async killSessionById(sessionId: string) {
    const p: any = prisma as any;
    return p.session.update({ where: { id: sessionId }, data: { isActive: false } });
  },

  async killSessionsByUser(userId: string) {
    const p: any = prisma as any;
    return p.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
  }
};
