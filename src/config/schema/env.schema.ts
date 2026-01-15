import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),

  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URL: z.string().startsWith("mongodb+srv://").includes("mongodb.net/?appName=Cluster"),
  MONGO_USER: z.string().endsWith("_db_user"),
  MONGO_PASS: z.string().min(16),

  JWT_SECRET: z.string(),

  REDIS_URL: z.string(),

  ARCJET_KEY: z.string().min(6, "ARCJET_KEY must be at least 6 char").startsWith("ajkey_"),
  ARCJET_ENV: z.enum(["development", "test", "production"]),

  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().min(6, "GEMINI_MODEL must be at least 6 chars").startsWith("gemini"),

  ORIGIN: z.string().min(7, "ORIGIN must be at least 7 char").startsWith("http"),
});
