import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { startChat } from '../../controllers/chat.controller.js';
import { mockRedisClient, mockGeminiAI, mockChat, mockLogger, resetAllMocks } from '../setup/mocks.js';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from '../setup/testHelpers.js';

// Mock dependencies
jest.mock('../../config/redis.config.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../utils/logger.js', () => ({
  default: mockLogger,
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

jest.mock('../../config/env.config.js', () => ({
  GEMINI_MODEL: 'gemini-2.0-flash-001',
}));

describe('Chat Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    resetAllMocks();
    mockChat.sendMessage.mockResolvedValue({
      text: 'This is a mock AI response about Nigerian tax reforms.',
    });
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('startChat', () => {
    it('should successfully respond to a valid chat request', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the 2026 tax brackets in Nigeria?',
      };
      mockRedisClient.get.mockResolvedValue(null); // No tax context

      await startChat(req as any, res as Response, next);

      expect(mockGeminiAI.chats.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash-001',
          history: expect.any(Array),
          config: expect.objectContaining({
            maxOutputTokens: 500,
            temperature: 0.7,
            safetySettings: expect.any(Array),
          }),
        })
      );
      expect(mockChat.sendMessage).toHaveBeenCalledWith({
        message: 'What are the 2026 tax brackets in Nigeria?',
      });
      expect(res.json).toHaveBeenCalledWith({
        AIResponse: 'This is a mock AI response about Nigerian tax reforms.',
      });
    });

    it('should return 400 when prompt is missing', async () => {
      req.body = {
        userID: 'test-user-123',
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No prompt provided',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('No prompt provided');
      expect(mockChat.sendMessage).not.toHaveBeenCalled();
    });

    it('should return 400 when prompt is empty string', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: '',
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No prompt provided',
      });
    });

    it('should return 400 when prompt exceeds 200 characters', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'a'.repeat(201), // 201 characters
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prompt length exceeded.',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Prompt length exceeded.');
      expect(mockChat.sendMessage).not.toHaveBeenCalled();
    });

    it('should return 400 when userID is missing', async () => {
      req.body = {
        prompt: 'What are the tax brackets?',
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required!',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid user ID.');
    });

    it('should return 400 when userID is empty string', async () => {
      req.body = {
        userID: '   ',
        prompt: 'What are the tax brackets?',
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required!',
      });
    });

    it('should return 400 when userID is not a string', async () => {
      req.body = {
        userID: 12345,
        prompt: 'What are the tax brackets?',
      };

      await startChat(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required!',
      });
    });

    it('should include tax context when available in Redis', async () => {
      const taxContext = {
        grossIncome: 6000000,
        totalDeductions: 500000,
        taxableIncome: 5500000,
        taxOwed: 650000,
        effectiveTaxRate: 10.83,
        afterTaxIncome: 5350000,
      };

      req.body = {
        userID: 'test-user-123',
        prompt: 'Explain my tax calculation',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(taxContext));

      await startChat(req as any, res as Response, next);

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-user-123');
      expect(mockGeminiAI.chats.create).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('₦6,000,000'),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should work without tax context when Redis returns null', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue(null);

      await startChat(req as any, res as Response, next);

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-user-123');
      expect(mockGeminiAI.chats.create).toHaveBeenCalled();
      expect(mockChat.sendMessage).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle Redis errors when fetching tax context', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      await startChat(req as any, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid User ID'),
        })
      );
    });

    it('should handle Gemini API errors', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockChat.sendMessage.mockRejectedValue(new Error('Gemini API error'));

      await startChat(req as any, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle invalid JSON in Redis tax context', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue('invalid-json');

      await startChat(req as any, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should create chat with correct system prompt', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue(null);

      await startChat(req as any, res as Response, next);

      const createCallArgs = mockGeminiAI.chats.create.mock.calls[0][0];
      const systemMessage = createCallArgs.history[0];

      expect(systemMessage.role).toBe('user');
      expect(systemMessage.parts[0].text).toContain('Nigeria');
      expect(systemMessage.parts[0].text).toContain('2026');
      expect(systemMessage.parts[0].text).toContain('tax');
    });

    it('should create chat with model confirmation in history', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue(null);

      await startChat(req as any, res as Response, next);

      const createCallArgs = mockGeminiAI.chats.create.mock.calls[0][0];
      const modelConfirmation = createCallArgs.history[1];

      expect(modelConfirmation.role).toBe('model');
      expect(modelConfirmation.parts[0].text).toContain('Understood');
    });

    it('should set correct safety settings', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'What are the tax brackets?',
      };
      mockRedisClient.get.mockResolvedValue(null);

      await startChat(req as any, res as Response, next);

      const createCallArgs = mockGeminiAI.chats.create.mock.calls[0][0];

      expect(createCallArgs.config.safetySettings).toEqual([
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
      ]);
    });

    it('should accept prompt with exactly 200 characters', async () => {
      req.body = {
        userID: 'test-user-123',
        prompt: 'a'.repeat(200), // Exactly 200 characters
      };
      mockRedisClient.get.mockResolvedValue(null);

      await startChat(req as any, res as Response, next);

      expect(mockChat.sendMessage).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('should format tax context with proper currency symbols', async () => {
      const taxContext = {
        grossIncome: 6000000,
        totalDeductions: 500000,
        taxableIncome: 5500000,
        taxOwed: 650000,
        effectiveTaxRate: 10.83,
        afterTaxIncome: 5350000,
      };

      req.body = {
        userID: 'test-user-123',
        prompt: 'Explain my taxes',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(taxContext));

      await startChat(req as any, res as Response, next);

      const createCallArgs = mockGeminiAI.chats.create.mock.calls[0][0];
      const systemPrompt = createCallArgs.history[0].parts[0].text;

      expect(systemPrompt).toContain('₦');
      expect(systemPrompt).toContain('6,000,000');
      expect(systemPrompt).toContain('10.83%');
    });
  });
});
