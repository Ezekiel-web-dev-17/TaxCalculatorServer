import { Router } from "express";
import { calculate } from "../controllers/tax.controller.js";

export const taxRouter = Router();

taxRouter.post("/calculate", calculate)