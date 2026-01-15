import { jest } from '@jest/globals';
import type { Response } from 'express';

/**
 * Create a mock Express Response object
 */
export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    statusCode: 200,
  };
  return res;
};

/**
 * Create a mock Express Request object
 */
export const createMockRequest = (overrides: any = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
};

/**
 * Create a mock Next Function
 */
export const createMockNext = () => jest.fn();

/**
 * Sample valid tax calculation data
 */
export const validTaxCalculationData = {
  monthlyGrossIncome: 500000,
  additionalMonthlyIncome: 50000,
  annualPensionContributions: 300000,
  annualNHFContributions: 5000,
  annualRentPaid: 600000,
  lifeInsurancePremiums: 40000,
};

/**
 * Sample tax calculation result
 */
export const sampleTaxResult = {
  grossIncome: 6600000,
  totalDeductions: 565000,
  taxableIncome: 6035000,
  taxOwed: 731300,
  effectiveTaxRate: 11.08,
  afterTaxIncome: 5868700,
};

/**
 * Generate a mock user ID
 */
export const generateMockUserID = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
};
