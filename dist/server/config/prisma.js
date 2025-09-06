"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.verifyPostgresConnection = verifyPostgresConnection;
const client_1 = require("@prisma/client");
const databaseUrl = process.env.DATABASE_URL || "postgresql://username:password@localhost:5432/warehousewizard?schema=public";
exports.prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: databaseUrl
        }
    },
    log: ['error', 'warn'],
    errorFormat: 'pretty'
});
console.log("✅ Prisma client initialized with PostgreSQL");
async function verifyPostgresConnection() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        console.log("✅ Connected to PostgreSQL via Prisma");
    }
    catch (error) {
        console.error("❌ PostgreSQL connection failed:", error);
        throw error;
    }
}
//# sourceMappingURL=prisma.js.map