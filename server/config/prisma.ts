import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function verifyPostgresConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connected to Postgres (Prisma)");
  } catch (error) {
    console.error("❌ Postgres connection failed:", error);
    throw error;
  }
}

