import type { NextFunction, Request, Response } from "express";
import logger from "../utils/logger.js";

// Global error-handling middleware for Express
interface AppError extends Error {
  statusCode?: number;
  code?: number;
  errors?: Record<string, { message: string }>;
}

const errorMiddleware = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error with stack trace
  logger.error(err.message, { stack: err.stack, code: err.code });

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Handle specific error types
  if (err.name === "CastError") {
    statusCode = 404;
    message = "Resource not found";
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Never expose internal error details in production
  const isDev = process.env.NODE_ENV === "development";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(isDev && { stack: err.stack }), // Only show stack in dev
  });
};

export default errorMiddleware;