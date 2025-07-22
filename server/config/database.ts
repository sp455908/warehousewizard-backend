import mongoose from "mongoose";

export interface DatabaseConfig {
  mongodb: {
    uri: string;
    options: mongoose.ConnectOptions;
  };
}

const config: DatabaseConfig = {
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

export async function connectToMongoDB() {
  if (isMongoConnected) {
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    isMongoConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

export const isMongoDBConnected = () => isMongoConnected;

export default config;