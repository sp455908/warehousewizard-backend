// Only import PrismaClient if DATABASE_URL is available
const databaseUrl = process.env.DATABASE_URL;
let prisma: any = null;

if (databaseUrl && databaseUrl.trim() !== '') {
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });
    console.log("✅ Prisma client initialized");
  } catch (error) {
    console.warn("⚠️  Failed to initialize Prisma client:", error);
    prisma = null;
  }
} else {
  console.warn("⚠️  DATABASE_URL not found or empty. Prisma will not be available.");
}

export { prisma };

export async function verifyPostgresConnection(): Promise<void> {
  if (!prisma) {
    console.warn("⚠️  Prisma client not initialized. Skipping PostgreSQL connection.");
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Connected to Postgres (Prisma)");
  } catch (error) {
    console.error("❌ Postgres connection failed:", error);
    throw error;
  }
}

