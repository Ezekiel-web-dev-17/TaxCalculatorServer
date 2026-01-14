import type { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis.config.js";

interface CalculateBody {
    monthlyGrossIncome: number;
    additionalMonthlyIncome?: number;
    annualPensionContributions?: number;
    annualNHFContributions?: number;
    annualRentPaid?: number;
    lifeInsurancePremiums?: number;
}

export const calculate = async (req:Request <{}, {}, CalculateBody>, res:Response, next:NextFunction) => {
    try {
        const {monthlyGrossIncome, additionalMonthlyIncome, annualPensionContributions, annualNHFContributions, annualRentPaid, lifeInsurancePremiums} = req.body
        if (!monthlyGrossIncome) return res.status(402).json({success: false, message: "Monthly gross income is required!"})
        const userID = new Date().getTime().toString(36)
        const redisClient = getRedisClient();
        await redisClient.setEx(userID, 60*60*24, JSON.stringify({monthlyGrossIncome, additionalMonthlyIncome, annualPensionContributions, annualNHFContributions, annualRentPaid, lifeInsurancePremiums}))
        const savedCalculation = await redisClient.get(userID)
        res.json({success: true, message: "Calculation successful!", userID, savedCalculation})
    } catch (error) {
        next(error)
    }    
}
