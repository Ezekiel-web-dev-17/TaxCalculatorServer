import app from "./app.js";
import { NODE_ENV, PORT } from "./config/env.config.js";
import { connectRedis } from "./config/redis.config.js";
import { connectDB } from "./database/dbconnect.js";
import logger from "./utils/logger.js";

const startServer = async () => {
  try {
    // Connect to databases first
    await connectDB();
    await connectRedis();

    // Then start server
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}, on: ${NODE_ENV}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
