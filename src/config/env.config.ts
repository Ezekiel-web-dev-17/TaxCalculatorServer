import { config } from "dotenv";

config({path: `.env.${process.env.NODE_ENV || "development"}.local`})

export const {PORT, MONGO_URL, JWT_SECRET, REDIS_URL, ARCJET_KEY, GEMINI_API_KEY, GEMINI_MODEL} = process.env