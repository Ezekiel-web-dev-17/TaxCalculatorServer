import { Router } from "express";
import { startChat } from "../controllers/chat.controller.js";
import { chatRateLimiter } from "../middleware/chatRateLimit.middleware.js";

const chatRoute =  Router();

// Apply rate limiter before the chat controller
chatRoute.post('/', chatRateLimiter, startChat);

export default chatRoute;
