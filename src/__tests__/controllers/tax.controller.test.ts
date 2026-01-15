import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { calculate, getCalculation } from '../../controllers/tax.controller.js';
import { mockRedisClient, mockLogger, resetAllMocks } from '../setup/mocks.js';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  validTaxCalculationData,
} from '../setup/testHelpers.js';

// Mock dependencies
jest.mock('../../config/redis.config.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../utils/logger.js', () => ({
  default: mockLogger,
}));

describe('Tax Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    resetAllMocks();
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext() as any;
  });

  describe('calculate', () => {
    it('should successfully calculate tax with all valid inputs', async () => {
      req.body = validTaxCalculationData;
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Calculation successful!',
          userID: expect.any(String),
          taxCalculation: expect.objectContaining({
            grossIncome: expect.any(Number),
            totalDeductions: expect.any(Number),
            taxableIncome: expect.any(Number),
            taxOwed: expect.any(Number),
            effectiveTaxRate: expect.any(Number),
            afterTaxIncome: expect.any(Number),
          }),
        })
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.any(String),
        60 * 60 * 24,
        expect.any(String)
      );
    });

    it('should successfully calculate tax with only required fields', async () => {
      req.body = { monthlyGrossIncome: 500000 };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          taxCalculation: expect.objectContaining({
            grossIncome: 6000000,
            taxableIncome: expect.any(Number),
          }),
        })
      );
    });

    it('should return 400 when monthlyGrossIncome is missing', async () => {
      req.body = {};

      await calculate(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Monthly gross income is required and must be a valid number!',
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return 400 when monthlyGrossIncome is not a number', async () => {
      req.body = { monthlyGrossIncome: 'invalid' };

      await calculate(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Monthly gross income is required and must be a valid number!',
      });
    });

    it('should return 400 when monthlyGrossIncome is negative', async () => {
      req.body = { monthlyGrossIncome: -100000 };

      await calculate(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Monthly gross income must be a positive number!',
      });
    });

    it('should return 400 when additionalMonthlyIncome is negative', async () => {
      req.body = {
        monthlyGrossIncome: 500000,
        additionalMonthlyIncome: -50000,
      };

      await calculate(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Additional monthly income must be a non-negative number!',
      });
    });

    it('should return 400 when input values exceed reasonable limits', async () => {
      req.body = {
        monthlyGrossIncome: 100_000_000_001, // Exceeds 100 billion
      };

      await calculate(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Input values exceed reasonable limits!',
      });
    });

    it('should correctly calculate tax for low income (below first bracket)', async () => {
      req.body = { monthlyGrossIncome: 50000 }; // 600,000 annually, below 800,000
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      expect(callArgs.calculation.taxOwed).toBe(0); // Should be tax-free
    });

    it('should correctly calculate tax for middle income', async () => {
      req.body = { monthlyGrossIncome: 300000 }; // 3,600,000 annually
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      // First 800k = 0, next 2,200k @ 15% = 330,000, next 600k @ 18% = 108,000
      // Total should be around 438,000
      expect(callArgs.calculation.taxOwed).toBeGreaterThan(400000);
      expect(callArgs.calculation.taxOwed).toBeLessThan(500000);
    });

    it('should correctly calculate tax for high income', async () => {
      req.body = { monthlyGrossIncome: 5000000 }; // 60,000,000 annually
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      expect(callArgs.calculation.taxOwed).toBeGreaterThan(10000000);
    });

    it('should apply pension deduction cap correctly', async () => {
      req.body = {
        monthlyGrossIncome: 500000,
        annualPensionContributions: 1000000, // More than 10% of gross
      };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      // Pension deduction should be capped at 10% of gross income (600,000)
      expect(callArgs.calculation.totalDeductions).toBeLessThanOrEqual(600000);
    });

    it('should apply NHF deduction cap correctly', async () => {
      req.body = {
        monthlyGrossIncome: 500000,
        annualNHFContributions: 10000, // More than 5,000 cap
      };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      // NHF should be capped at 5,000
      expect(callArgs.calculation.totalDeductions).toBe(5000);
    });

    it('should apply rent deduction correctly for rent > 500,000', async () => {
      req.body = {
        monthlyGrossIncome: 500000,
        annualRentPaid: 1000000, // Greater than 500k
      };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      // Rent deduction should be capped at 500,000
      expect(callArgs.calculation.totalDeductions).toBe(500000);
    });

    it('should apply rent deduction correctly for rent <= 500,000', async () => {
      req.body = {
        monthlyGrossIncome: 500000,
        annualRentPaid: 400000, // Less than 500k
      };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      // Rent deduction should be 20% of 400,000 = 80,000
      expect(callArgs.calculation.totalDeductions).toBe(80000);
    });

    it('should handle Redis failure gracefully', async () => {
      req.body = validTaxCalculationData;
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis connection failed'));

      await calculate(req as any, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Calculation successful! (Note: Unable to save for later retrieval)',
          userID: null,
          calculation: expect.any(Object),
        })
      );
    });

    it('should generate unique user IDs', async () => {
      req.body = validTaxCalculationData;
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);
      const firstCall = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      const firstUserID = firstCall.userID;

      // Reset and call again
      (res.json as jest.Mock).mockClear();
      await calculate(req as any, res as Response, next);
      const secondCall = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      const secondUserID = secondCall.userID;

      expect(firstUserID).not.toBe(secondUserID);
    });

    it('should handle unexpected errors and call next', async () => {
      req.body = validTaxCalculationData;
      mockRedisClient.setEx.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await calculate(req as any, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should calculate effective tax rate correctly', async () => {
      req.body = { monthlyGrossIncome: 500000 };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      const { grossIncome, taxOwed, effectiveTaxRate } = callArgs.calculation;

      const expectedRate = Math.round((taxOwed / grossIncome) * 10000) / 100;
      expect(effectiveTaxRate).toBe(expectedRate);
    });

    it('should calculate after-tax income correctly', async () => {
      req.body = { monthlyGrossIncome: 500000 };
      mockRedisClient.setEx.mockResolvedValue('OK');

      await calculate(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      const { grossIncome, taxOwed, afterTaxIncome } = callArgs.calculation;

      expect(afterTaxIncome).toBe(Math.round((grossIncome - taxOwed) * 100) / 100);
    });
  });

  describe('getCalculation', () => {
    const validUserID = 'test-123-abc';
    const savedCalculation = {
      grossIncome: 6000000,
      totalDeductions: 500000,
      taxableIncome: 5500000,
      taxOwed: 650000,
      effectiveTaxRate: 10.83,
      afterTaxIncome: 5350000,
    };

    it('should successfully retrieve saved calculation', async () => {
      req.params = { userID: validUserID };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(savedCalculation));

      await getCalculation(req as any, res as Response, next);

      expect(mockRedisClient.get).toHaveBeenCalledWith(validUserID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Calculation retrieved successfully!',
        userID: validUserID,
        calculation: savedCalculation,
      });
    });

    it('should return 400 when userID is missing', async () => {
      req.params = {};

      await getCalculation(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required!',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid user ID.');
    });

    it('should return 400 when userID is empty string', async () => {
      req.params = { userID: '   ' };

      await getCalculation(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required!',
      });
    });

    it('should return 404 when calculation is not found', async () => {
      req.params = { userID: 'non-existent-id' };
      mockRedisClient.get.mockResolvedValue(null);

      await getCalculation(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Calculation not found or expired!',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Calculation not found or expired!');
    });

    it('should handle Redis errors and call next', async () => {
      req.params = { userID: validUserID };
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      await getCalculation(req as any, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should parse JSON from Redis correctly', async () => {
      req.params = { userID: validUserID };
      const jsonString = JSON.stringify(savedCalculation);
      mockRedisClient.get.mockResolvedValue(jsonString);

      await getCalculation(req as any, res as Response, next);

      const callArgs = (res.json as jest.Mock).mock.calls[0]?.[0] as any;
      expect(callArgs.calculation).toEqual(savedCalculation);
    });
  });
});
