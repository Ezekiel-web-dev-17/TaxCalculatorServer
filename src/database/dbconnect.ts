import mongoose from "mongoose";
import { MONGO_URL } from "../config/env.config.js";
import logger from "../utils/logger.js";
import { registerCleanup } from "../utils/disconnectors.js";

// Connection options for optimal performance
const mongoOptions: mongoose.ConnectOptions = {
  // Connection Pool Settings
  maxPoolSize: 10, // Max number of connections in the pool (default: 100, reduce for smaller apps)
  minPoolSize: 2, // Min connections to keep open (helps with cold starts)

  // Timeout Settings
  connectTimeoutMS: 10000, // How long to wait for initial connection
  socketTimeoutMS: 45000, // How long a socket can be inactive before closing
  serverSelectionTimeoutMS: 5000, // How long to wait for server selection

  // Heartbeat & Keep-Alive
  heartbeatFrequencyMS: 10000, // How often to check server status

  // Retry Settings
  retryWrites: true, // Retry failed write operations
  retryReads: true, // Retry failed read operations

  // Write Concern (balance between speed and durability)
  w: "majority", // Wait for write acknowledgment from majority of replicas
};

// Create connection function for better control
export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    if (!MONGO_URL) {
      throw new Error("Please provide MONGO_URL in the environment variables");
    }
    const connection = await mongoose.connect(MONGO_URL, mongoOptions);

    logger.info(`MongoDB connected: ${connection.connection.host}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    return connection;
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    process.exit(1); // Exit if initial connection fails
  }
};

// Graceful shutdown
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed gracefully");
  } catch (error) {
    logger.error("Error closing MongoDB connection:", error);
  }
};

registerCleanup(disconnectDB);
