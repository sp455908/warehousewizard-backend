import mongoose from "mongoose";
export interface DatabaseConfig {
    mongodb: {
        uri: string;
        options: mongoose.ConnectOptions;
    };
}
declare const config: DatabaseConfig;
export declare function connectToMongoDB(): Promise<void>;
export declare const isMongoDBConnected: () => boolean;
export default config;
//# sourceMappingURL=database.d.ts.map