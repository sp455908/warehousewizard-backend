import { PrismaClient } from "@prisma/client";

// Get DATABASE_URL from environment - using Supabase session pooler for IPv4 compatibility
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres.miswjgxxtegiltbnyalz:4kPSYIJfNCGnDylE@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

// Initialize Prisma client with proper configuration for Supabase session pooler
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
    // Use a simple connection test that works with the pooler
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL via Prisma");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    throw error;
  }
}

