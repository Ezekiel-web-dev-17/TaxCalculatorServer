import logger from "./logger.js";

// Collect all cleanup functions
const cleanupHandlers: Array<() => Promise<void>> = [];

// Register a cleanup function
export const registerCleanup = (handler: () => Promise<void>): void => {
  cleanupHandlers.push(handler);
};

// Run all cleanup functions and exit
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Run all cleanup handlers in parallel
    await Promise.allSettled(
      cleanupHandlers.map((handler) => handler())
    );
    logger.info("Shutdown complete!");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Register handlers once
let isShuttingDown = false;

const handleSignal = (signal: string) => {
  if (isShuttingDown) return; // Prevent multiple shutdowns
  isShuttingDown = true;
  shutdown(signal);
};

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));