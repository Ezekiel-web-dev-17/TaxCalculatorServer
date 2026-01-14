import { Router } from "express";
import { calculate , getCalculation} from "../controllers/tax.controller.js";

export const taxRouter = Router();

taxRouter.post("/calculate", calculate)
taxRouter.get("/get-calculation/:userID", getCalculation)