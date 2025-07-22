import mongoose from "mongoose";
export interface DatabaseConfig {
    mongodb: {
        uri: string;
        options: mongoose.ConnectOptions;
    };
    redis: {
        url: string;
        options: any;
    };
}
declare const config: DatabaseConfig;
export declare function connectToMongoDB(): Promise<void>;
export declare function connectToRedis(): Promise<any>;
export declare const getRedisClient: () => any;
export declare const isMongoDBConnected: () => boolean;
export default config;
//# sourceMappingURL=database.d.ts.map