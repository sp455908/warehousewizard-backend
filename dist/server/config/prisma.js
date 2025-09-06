"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.verifyPostgresConnection = verifyPostgresConnection;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
async function verifyPostgresConnection() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        console.log("✅ Connected to Postgres (Prisma)");
    }
    catch (error) {
        console.error("❌ Postgres connection failed:", error);
        throw error;
    }
}
//# sourceMappingURL=prisma.js.map