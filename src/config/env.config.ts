import { config } from "dotenv";
import { envSchema } from "./schema/env.schema.js";

config({path: `.env.${process.env.NODE_ENV || "development"}.local`})


import dotenv from "dotenv";
import fs from "fs";

// Phase 1: load base env (content is only NODE_ENV)
dotenv.config({ path: ".env" });

// Phase 2: load env-specific file
const env = process.env.NODE_ENV ?? "development";

dotenv.config({
  path: `.env.${env}.local`,
});

const parsed = envSchema.safeParse({
  ...process.env,
});

if (!parsed.success) {
  console.error("Invalid environment variables: ", parsed.error.format());
  process.exit(1);
}

if (!fs.existsSync(`.env.${parsed.data?.NODE_ENV}.local`)) {
  throw new Error(`Missing env file: ${`.env.${parsed.data?.NODE_ENV}.local`}`);
}

if (
  parsed.data.NODE_ENV === "production" &&
  parsed.data.MONGO_URL            
) {
  throw new Error("Production cannot use localhost database");
}

/**
 * Export typed, immutable env
 */
export const { NODE_ENV, PORT, MONGO_URL, MONGO_USER, MONGO_PASS, JWT_SECRET, REDIS_URL, ARCJET_KEY, ARCJET_ENV, GEMINI_API_KEY, GEMINI_MODEL, ORIGIN } =
  Object.freeze(parsed.data);
