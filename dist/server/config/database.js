"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMongoDBConnected = void 0;
exports.connectToMongoDB = connectToMongoDB;
const mongoose_1 = __importDefault(require("mongoose"));
const config = {
    mongodb: {
        uri: process.env.MONGO_URI || "mongodb+srv://shubhampatil:ibt42OGlE5iwvVgC@cluster0.hp3wltk.mongodb.net/warehouse-wizard",
        options: {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        },
    },
};
let isMongoConnected = false;
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
const isMongoDBConnected = () => isMongoConnected;
exports.isMongoDBConnected = isMongoDBConnected;
exports.default = config;
//# sourceMappingURL=database.js.map