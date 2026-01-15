import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { mockRedisClient, mockLogger, resetAllMocks } from '../setup/mocks.js';
import { validTaxCalculationData } from '../setup/testHelpers.js';

// Mock dependencies
jest.mock('../../config/redis.config.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../utils/logger.js', () => ({
  default: mockLogger,
  morganStream: {
    write: jest.fn(),
  },
}));

jest.mock('../../middleware/arcject.middleware.js', () => ({
  arcjetMiddleware: jest.fn((req, res, next: any) => next()),
}));

jest.mock('../../config/env.config.js', () => ({
  ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
}));

describe('Tax Routes Integration Tests', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('POST /api/v1/tax/calculate', () => {
    it('should calculate tax successfully with valid data', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send(validTaxCalculationData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Calculation successful!');
      expect(response.body).toHaveProperty('userID');
      expect(response.body.userID).toBeTruthy();
      expect(response.body).toHaveProperty('calculation');
      expect(response.body.calculation).toHaveProperty('grossIncome');
      expect(response.body.calculation).toHaveProperty('totalDeductions');
      expect(response.body.calculation).toHaveProperty('taxableIncome');
      expect(response.body.calculation).toHaveProperty('taxOwed');
      expect(response.body.calculation).toHaveProperty('effectiveTaxRate');
      expect(response.body.calculation).toHaveProperty('afterTaxIncome');
    });

    it('should calculate tax with minimal required data', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: 500000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.calculation.grossIncome).toBe(6000000);
    });

    it('should return 400 when monthlyGrossIncome is missing', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Monthly gross income');
    });

    it('should return 400 when monthlyGrossIncome is negative', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: -100000 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('positive number');
    });

    it('should return 400 when values exceed reasonable limits', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: 100_000_000_001 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exceed reasonable limits');
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send(validTaxCalculationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userID).toBeNull();
      expect(response.body.message).toContain('Unable to save');
    });

    it('should reject requests with invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express will handle malformed JSON with 400
      expect(response.status).toBe(400);
    });

    it('should enforce body size limit', async () => {
      const largeData = {
        monthlyGrossIncome: 500000,
        extraData: 'a'.repeat(20000), // Larger than 10kb limit
      };

      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send(largeData);

      expect(response.status).toBe(413); // Payload too large
    });

    it('should return consistent calculation results', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      const inputData = { monthlyGrossIncome: 300000 };

      const response1 = await request(app)
        .post('/api/v1/tax/calculate')
        .send(inputData)
        .expect(200);

      const response2 = await request(app)
        .post('/api/v1/tax/calculate')
        .send(inputData)
        .expect(200);

      // Same input should produce same calculation (excluding userID)
      expect(response1.body.calculation).toEqual(response2.body.calculation);
    });

    it('should generate unique userIDs for each calculation', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const response1 = await request(app)
        .post('/api/v1/tax/calculate')
        .send(validTaxCalculationData)
        .expect(200);

      const response2 = await request(app)
        .post('/api/v1/tax/calculate')
        .send(validTaxCalculationData)
        .expect(200);

      expect(response1.body.userID).not.toBe(response2.body.userID);
    });
  });

  describe('GET /api/v1/tax/get-calculation/:userID', () => {
    const testUserID = 'test-user-123';
    const savedCalculation = {
      grossIncome: 6000000,
      totalDeductions: 500000,
      taxableIncome: 5500000,
      taxOwed: 650000,
      effectiveTaxRate: 10.83,
      afterTaxIncome: 5350000,
    };

    it('should retrieve saved calculation successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(savedCalculation));

      const response = await request(app)
        .get(`/api/v1/tax/get-calculation/${testUserID}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Calculation retrieved successfully!');
      expect(response.body.userID).toBe(testUserID);
      expect(response.body.calculation).toEqual(savedCalculation);
    });

    it('should return 404 when calculation not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/tax/get-calculation/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found or expired');
    });

    it('should return 400 when userID is empty', async () => {
      const response = await request(app)
        .get('/api/v1/tax/get-calculation/   ')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid user ID is required');
    });

    it('should handle special characters in userID', async () => {
      const specialUserID = 'user-123-abc_xyz';
      mockRedisClient.get.mockResolvedValue(JSON.stringify(savedCalculation));

      const response = await request(app)
        .get(`/api/v1/tax/get-calculation/${specialUserID}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith(specialUserID);
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get(`/api/v1/tax/get-calculation/${testUserID}`);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Route Security', () => {
    it('should have security headers from Helmet', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('referrer-policy', 'no-referrer');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/tax/non-existent')
        .expect(404);

      expect(response.status).toBe(404);
    });
  });
});
