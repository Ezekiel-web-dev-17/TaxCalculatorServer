import fs from "fs";
import dotenv from "dotenv";
import { envSchema } from "./schema/env.schema.js";

/**
 * Resolve environment
 */
export const NODE_ENV = process.env.NODE_ENV ?? "development";
const isTest = NODE_ENV === "test";
const isProduction = NODE_ENV === "production";

/**
 * Phase 1: Load base .env (optional)
 * Contains minimal values like NODE_ENV
 */
if (fs.existsSync(".env")) {
    dotenv.config({ path: ".env" });
}

/**
 * Phase 2: Load environment-specific overrides (local dev only)
 * Example: .env.development.local
 */
const envFile = `.env.${NODE_ENV}.local`;

if (!isProduction && !isTest && fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
}

/**
 * Phase 3: Validate environment variables
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success && !isTest) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.format());
    process.exit(1);
}

/**
 * Phase 4: Production safety checks
 */
if (
    parsed.success &&
    isProduction &&
    parsed.data.MONGO_URL?.includes("localhost")
) {
    throw new Error("❌ Production cannot use a localhost MongoDB URL");
}

/**
 * Phase 5: Export immutable, typed env
 * In test mode, fallback to process.env
 */
const envData = parsed.success ? parsed.data : process.env;

export const {
    PORT,
    MONGO_URL,
    MONGO_USER,
    MONGO_PASS,
    JWT_SECRET,
    REDIS_URL,
    ARCJET_KEY,
    ARCJET_ENV,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    ORIGIN,
} = Object.freeze(envData);
