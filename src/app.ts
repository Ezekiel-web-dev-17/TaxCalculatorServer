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

const app = express();

// Security middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS protection

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
