import { PrismaClient } from "@prisma/client";

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL || "postgresql://username:password@localhost:5432/warehousewizard?schema=public";

// Initialize Prisma client with proper configuration to avoid enableTracing error
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  },
  log: ['error', 'warn'],
  errorFormat: 'pretty'
});

console.log("✅ Prisma client initialized with PostgreSQL");

export async function verifyPostgresConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connected to PostgreSQL via Prisma");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    throw error;
  }
}

