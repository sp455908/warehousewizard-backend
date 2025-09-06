import { PrismaClient } from "@prisma/client";
export declare const prisma: PrismaClient<{
    datasources: {
        db: {
            url: string;
        };
    };
    log: ("warn" | "error")[];
    errorFormat: "pretty";
}, "warn" | "error", import("@prisma/client/runtime/library").DefaultArgs>;
export declare function verifyPostgresConnection(): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map