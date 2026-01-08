import app from "./app.js";
import { PORT } from "./config/env.config.js";
import { connectRedis } from "./config/redis.config.js";
import { startChat } from "./controllers/chat.controller.js";
import { connectDB } from "./database/dbconnect.js";
import logger from "./utils/logger.js";

const startServer = async () => {
  try {
    // Connect to databases first
    await connectDB();
    await connectRedis();

    // Then start server
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    await startChat();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
