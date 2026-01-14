import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),

  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URL: z.string(),
  MONGO_USER: z.string(),
  MONGO_PASS: z.string(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),

  REDIS_URL: z.string().min(1, "REDIS_URL must be at least 1 char"),

  ARCJET_KEY: z.string().min(1, "ARCJET_KEY must be at least 1 char"),
  ARCJET_ENV: z.enum(["development", "test", "production"]),

  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY must be at least 1 char"),
  GEMINI_MODEL: z.string().min(6, "GEMINI_MODEL must be at least 6 chars"),

  ORIGIN: z.string().min(1, "ORIGIN must be at least 1 char").optional(),
});
