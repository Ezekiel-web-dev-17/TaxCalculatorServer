import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { mockRedisClient, mockGeminiAI, mockChat, mockLogger, resetAllMocks } from '../setup/mocks.js';

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
  arcjetMiddleware: jest.fn((req, res, next) => next()),
}));

jest.mock('../../config/env.config.js', () => ({
  ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
  GEMINI_MODEL: 'gemini-2.0-flash-001',
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => mockGeminiAI),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'BLOCK_NONE',
  },
}));

describe('Chat Routes Integration Tests', () => {
  beforeEach(() => {
    resetAllMocks();
    mockChat.sendMessage.mockResolvedValue({
      text: 'This is a mock AI response about Nigerian tax reforms.',
    });
  });

  describe('POST /api/v1/chat', () => {
    it('should successfully respond to chat request', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'What are the 2026 tax brackets in Nigeria?',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('AIResponse');
      expect(response.body.AIResponse).toBe('This is a mock AI response about Nigerian tax reforms.');
    });

    it('should return 400 when prompt is missing', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
        })
        .expect(400);

      expect(response.body.error).toBe('No prompt provided');
    });

    it('should return 400 when prompt is empty', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: '',
        })
        .expect(400);

      expect(response.body.error).toBe('No prompt provided');
    });

    it('should return 400 when prompt exceeds 200 characters', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'a'.repeat(201),
        })
        .expect(400);

      expect(response.body.error).toBe('Prompt length exceeded.');
    });

    it('should accept prompt with exactly 200 characters', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'a'.repeat(200),
        })
        .expect(200);

      expect(response.body).toHaveProperty('AIResponse');
    });

    it('should return 400 when userID is missing', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          prompt: 'What are the tax brackets?',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid user ID is required');
    });

    it('should return 400 when userID is empty', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: '   ',
          prompt: 'What are the tax brackets?',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid user ID is required');
    });

    it('should work without tax context', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'Tell me about tax brackets',
        })
        .expect(200);

      expect(response.body.AIResponse).toBeDefined();
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-user-123');
    });

    it('should work with tax context from Redis', async () => {
      const taxContext = {
        grossIncome: 6000000,
        totalDeductions: 500000,
        taxableIncome: 5500000,
        taxOwed: 650000,
        effectiveTaxRate: 10.83,
        afterTaxIncome: 5350000,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(taxContext));

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'Explain my tax calculation',
        })
        .expect(200);

      expect(response.body.AIResponse).toBeDefined();
      expect(mockGeminiAI.chats.create).toHaveBeenCalled();
    });

    it('should handle special characters in prompt', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: "What's the tax on ₦5,000,000?",
        })
        .expect(200);

      expect(response.body.AIResponse).toBeDefined();
    });

    it('should handle AI errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockChat.sendMessage.mockRejectedValue(new Error('API error'));

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: 'What are the tax brackets?',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject requests with invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.status).toBe(400);
    });

    it('should enforce body size limit', async () => {
      const largeData = {
        userID: 'test-user-123',
        prompt: 'test',
        extraData: 'a'.repeat(20000), // Larger than 10kb limit
      };

      const response = await request(app)
        .post('/api/v1/chat')
        .send(largeData);

      expect(response.status).toBe(413); // Payload too large
    });

    it('should handle numeric userID gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 12345,
          prompt: 'What are the tax brackets?',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should trim whitespace from prompts during validation', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/chat')
        .send({
          userID: 'test-user-123',
          prompt: '  What are the tax brackets?  ',
        })
        .expect(200);

      expect(response.body.AIResponse).toBeDefined();
    });
  });
});
