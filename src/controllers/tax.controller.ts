import type { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis.config.js";
import { randomBytes } from "crypto";
import logger from "../utils/logger.js";

interface CalculateBody {
    monthlyGrossIncome: number;
    additionalMonthlyIncome?: number;
    annualPensionContributions?: number;
    annualNHFContributions?: number;
    annualRentPaid?: number;
    lifeInsurancePremiums?: number;
}

interface GetCalculateBody {
    userID: string;
}

interface taxResponse {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxOwed: number;
    effectiveTaxRate: number;
    afterTaxIncome: number;
}

/**
 * Validate that a value is a non-negative number
 */
function isValidNonNegativeNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && value >= 0 && isFinite(value);
}

/**
 * Calculate Nigerian tax owed based on 2026 PAYE tax brackets
 * @param taxableIncome - The taxable income after deductions
 * @returns The total tax owed
 */
function calculateNigeriaTax2026(taxableIncome: number): number {
    const brackets = [
        { limit: 800000, rate: 0 },       // First ₦800,000: 0% (Tax Exempt)
        { limit: 2200000, rate: 0.15 },   // Next ₦2,200,000: 15%
        { limit: 9000000, rate: 0.18 },   // Next ₦9,000,000: 18%
        { limit: 13000000, rate: 0.21 },  // Next ₦13,000,000: 21%
        { limit: 25000000, rate: 0.23 },  // Next ₦25,000,000: 23%
        { limit: Infinity, rate: 0.25 }   // Above ₦50,000,000: 25%
    ];

    let tax = 0;
    let remaining = taxableIncome;

    for (const bracket of brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, bracket.limit);
        tax += taxable * bracket.rate;
        remaining -= taxable;
    }

    return Math.round(tax * 100) / 100; // Round to 2 decimal places
}

/**
 * Generate a unique user ID using crypto.randomBytes
 */
function generateUniqueID(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(6).toString('hex');
    return `${timestamp}-${randomPart}`;
}

export const calculate = async (req: Request<{}, {}, CalculateBody>, res: Response, next: NextFunction) => {
    try {
        const {
            monthlyGrossIncome,
            additionalMonthlyIncome = 0,
            annualPensionContributions = 0,
            annualNHFContributions = 0,
            annualRentPaid = 0,
            lifeInsurancePremiums = 0
        } = req.body;

        // Validate required field
        if (!monthlyGrossIncome || typeof monthlyGrossIncome !== 'number') {
            logger.error("Monthly gross income is required and must be a valid number!");
            return res.status(400).json({ 
                success: false, 
                message: "Monthly gross income is required and must be a valid number!" 
            });
        }

        // Validate all numeric inputs are non-negative
        if (!isValidNonNegativeNumber(monthlyGrossIncome)) {
            logger.error("Monthly gross income must be a positive number!");
            return res.status(400).json({ 
                success: false, 
                message: "Monthly gross income must be a positive number!" 
            });
        }

        if (!isValidNonNegativeNumber(additionalMonthlyIncome)) {
            logger.error("Additional monthly income must be a non-negative number!");
            return res.status(400).json({ 
                success: false, 
                message: "Additional monthly income must be a non-negative number!" 
            });
        }

        if (!isValidNonNegativeNumber(annualPensionContributions)) {
            logger.error("Annual pension contributions must be a non-negative number!");
            return res.status(400).json({ 
                success: false, 
                message: "Annual pension contributions must be a non-negative number!" 
            });
        }

        if (!isValidNonNegativeNumber(annualNHFContributions)) {
            logger.error("Annual NHF contributions must be a non-negative number!");
            return res.status(400).json({ 
                success: false, 
                message: "Annual NHF contributions must be a non-negative number!" 
            });
        }

        if (!isValidNonNegativeNumber(annualRentPaid)) {
            logger.error("Annual rent paid must be a non-negative number!");
            return res.status(400).json({ 
                success: false, 
                message: "Annual rent paid must be a non-negative number!" 
            });
        }

        if (!isValidNonNegativeNumber(lifeInsurancePremiums)) {
            logger.error("Life insurance premiums must be a non-negative number!");
            return res.status(400).json({ 
                success: false, 
                message: "Life insurance premiums must be a non-negative number!" 
            });
        }

        // Reasonable upper bounds validation (100 billion naira)
        const MAX_REASONABLE_VALUE = 100_000_000_000;
        if (monthlyGrossIncome > MAX_REASONABLE_VALUE || 
            additionalMonthlyIncome > MAX_REASONABLE_VALUE ||
            annualPensionContributions > MAX_REASONABLE_VALUE ||
            annualNHFContributions > MAX_REASONABLE_VALUE ||
            annualRentPaid > MAX_REASONABLE_VALUE ||
            lifeInsurancePremiums > MAX_REASONABLE_VALUE) {
            return res.status(400).json({ 
                success: false, 
                message: "Input values exceed reasonable limits!" 
            });
        }

        // Calculate gross annual income
        const grossIncome = (monthlyGrossIncome + additionalMonthlyIncome) * 12;

        // Calculate allowable deductions with FIRS 2026 caps
        const pensionDeduction = Math.min(annualPensionContributions, grossIncome * 0.1);
        const nhfDeduction = Math.min(annualNHFContributions, 5000);
        const insuranceDeduction = Math.min(lifeInsurancePremiums, Math.min(50000, grossIncome * 0.1));

        let rentDeduction = 0
        if (annualRentPaid > 500000) {
            rentDeduction = 500000
        }else {
            rentDeduction = annualRentPaid * 0.2
        }

        const totalDeductions = pensionDeduction + nhfDeduction + insuranceDeduction + rentDeduction;

        // Calculate taxable income
        const taxableIncome = Math.max(0, grossIncome - totalDeductions);

        // Calculate tax owed using 2026 brackets
        const taxOwed = calculateNigeriaTax2026(taxableIncome);

        // Calculate effective tax rate as percentage
        const effectiveTaxRate = grossIncome > 0 ? Math.round((taxOwed / grossIncome) * 10000) / 100 : 0;

        // Calculate after-tax income
        const afterTaxIncome = grossIncome - taxOwed;

        const result: taxResponse = {
            grossIncome: Math.round(grossIncome * 100) / 100,
            totalDeductions: Math.round(totalDeductions * 100) / 100,
            taxableIncome: Math.round(taxableIncome * 100) / 100,
            taxOwed: Math.round(taxOwed * 100) / 100,
            effectiveTaxRate,
            afterTaxIncome: Math.round(afterTaxIncome * 100) / 100
        };

        // Generate unique user ID using crypto for better uniqueness
        const userID = generateUniqueID();
        
        try {
            const redisClient = getRedisClient();
            await redisClient.setEx(userID, 60 * 60 * 24, JSON.stringify(result));
        } catch (redisError) {
            console.error("Redis storage error:", redisError);
            // Still return the calculation even if Redis fails
            return res.json({ 
                success: true, 
                message: "Tax calculation successful! (Note: Unable to save for later retrieval)", 
                userID: null, 
                taxCalculation: result 
            });
        }

        res.json({ success: true, message: "Tax calculation successful!", userID, taxCalculation: result });
    } catch (error) {
        next(error);
    }
};

export const getCalculation = async (req: Request<{userID: string}, {}, {}>, res: Response, next: NextFunction) => {
    try {
        const { userID } = req.params;
        
        if (!userID || typeof userID !== 'string' || userID.trim() === '') {
            logger.error("Invalid user ID.");
            return res.status(400).json({ success: false, message: "Valid user ID is required!" });
        }

        const redisClient = getRedisClient();
        const fromRedis = await redisClient.get(userID);

        if (!fromRedis) {
            logger.error("Tax calculation not found or expired!");
            return res.status(404).json({ success: false, message: "Tax calculation not found or expired!" });
        }

        const savedCalculation: taxResponse = await JSON.parse(fromRedis);
        res.json({ success: true, message: "Tax calculation retrieved successfully!", userID, taxCalculation: savedCalculation });
    } catch (error) {
        next(error);
    }
};