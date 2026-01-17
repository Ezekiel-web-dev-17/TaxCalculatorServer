import express from "express";
import type { Request, Response } from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import { morganStream } from "./utils/logger.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { arcjetMiddleware } from "./middleware/arcject.middleware.js";
import chatRoute from "./routes/chat.route.js";
import { taxRouter } from "./routes/calculate.route.js";
import { ORIGIN, NODE_ENV } from "./config/env.config.js";

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,  // Not needed for API-only server
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hidePoweredBy: true,
  noSniff: true,
  hsts: NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
  } : false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: "no-referrer" },
})); // Security headers

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsing with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// HTTP request logging
app.use(morgan("dev", { stream: morganStream }));

// Rate Limiter
app.use(arcjetMiddleware);

// Routes
app.get("/api/v1/", (_req: Request, res: Response) => {
  res.send("Hello, TaxCalServer!");
});

app.use("/api/v1/chat", chatRoute);

app.use("/api/v1/tax", taxRouter);

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({
    status: "OK",
    success: true,
    timestamp: new Date().toLocaleString("en-US", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  });
});

// Error handling middleware
app.use(errorMiddleware);

export default app;
