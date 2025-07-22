"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMongoDBConnected = exports.getRedisClient = void 0;
exports.connectToMongoDB = connectToMongoDB;
exports.connectToRedis = connectToRedis;
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("redis");
const config = {
    mongodb: {
        uri: process.env.MONGODB_URI || "mongodb://localhost:27017/warehouse_wizard",
        options: {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            bufferMaxEntries: 0,
        },
    },
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
        options: {
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
        },
    },
};
let isMongoConnected = false;
let redisClient = null;
async function connectToMongoDB() {
    if (isMongoConnected) {
        return;
    }
    try {
        await mongoose_1.default.connect(config.mongodb.uri, config.mongodb.options);
        isMongoConnected = true;
        console.log("✅ Connected to MongoDB");
    }
    catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
    }
}
async function connectToRedis() {
    if (redisClient) {
        return redisClient;
    }
    try {
        redisClient = (0, redis_1.createClient)({
            url: config.redis.url,
            ...config.redis.options,
        });
        redisClient.on("error", (err) => {
            console.error("Redis Client Error:", err);
        });
        await redisClient.connect();
        console.log("✅ Connected to Redis");
        return redisClient;
    }
    catch (error) {
        console.warn("⚠️ Redis connection failed, continuing without cache:", error);
        return null;
    }
}
const getRedisClient = () => redisClient;
exports.getRedisClient = getRedisClient;
const isMongoDBConnected = () => isMongoConnected;
exports.isMongoDBConnected = isMongoDBConnected;
exports.default = config;
//# sourceMappingURL=database.js.map