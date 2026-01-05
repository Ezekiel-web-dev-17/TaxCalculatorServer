import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { REDIS_URL } from "./env.config.js";
import logger from "../utils/logger.js";
import { registerCleanup } from "../utils/disconnectors.js";

// Redis client instance
let redisClient: RedisClientType;

// Create and configure Redis client
export const createRedisClient = (): RedisClientType => {
  const client = createClient({
    url: REDIS_URL || "redis://localhost:6379",
    socket: {
      connectTimeout: 10000, // 10 seconds connection timeout
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error("Redis: Max reconnection attempts reached");
          return new Error("Max reconnection attempts reached");
        }
        // Exponential backoff: 100ms, 200ms, 400ms, ... up to 3s
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  // Event handlers
  client.on("connect", () => {
    logger.info("Redis: Connecting...");
  });

  client.on("ready", () => {
    logger.info("Redis: Connected and ready");
  });

  client.on("error", (err) => {
    logger.error("Redis: Connection error", err);
  });

  client.on("end", () => {
    logger.info("Redis: Connection closed");
  });

  return client as RedisClientType;
};

// Initialize and connect to Redis
export const connectRedis = async (): Promise<RedisClientType> => {
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error("Redis: Failed to connect", error);
    throw error;
  }
};

// Get the Redis client instance
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  }
  return redisClient;
};

// Disconnect from Redis
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info("Redis: Disconnected successfully");
  }
};

registerCleanup(disconnectRedis);

export default redisClient!;
