import type { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis.config.js";
import logger from "../utils/logger.js";

// Cache middleware factory
export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      const redis = getRedisClient();
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache HIT: ${cacheKey}`);
        return res.json(JSON.parse(cachedData));
      }

      logger.debug(`Cache MISS: ${cacheKey}`);

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);

      res.json = (body: unknown) => {
        // Cache the response asynchronously
        redis.setEx(cacheKey, ttlSeconds, JSON.stringify(body)).catch((err) => {
          logger.error("Redis cache set error:", err);
        });
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("Cache middleware error:", error);
      next(); // Continue without cache on error
    }
  };
};

// Clear cache by pattern
export const clearCache = async (pattern: string): Promise<number> => {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(`cache:${pattern}`);

    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Cleared ${keys.length} cache keys matching: ${pattern}`);
    }

    return keys.length;
  } catch (error) {
    logger.error("Clear cache error:", error);
    return 0;
  }
};

