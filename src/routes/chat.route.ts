import { Router } from "express";
import { startChat } from "../controllers/chat.controller.js";

const chatRoute =  Router();

chatRoute.post('/', startChat);

export default chatRoute;
