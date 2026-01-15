import { jest } from '@jest/globals';
import type { RedisClientType } from "redis";

// export const mockRedisClient = {
//   get: jest.fn<Promise<string | null>, [string]>(),
//   setEx: jest.fn<Promise<"OK">, [string, number, string]>(),
// }

export const mockRedisClient = {
  get: jest.fn(),
  setEx: jest.fn(),
  disconnect: jest.fn(),
  quit: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  isOpen: true,
  isReady: true,
} as unknown as jest.Mocked<RedisClientType>;;

// Mock Google Gemini AI
export const mockChat = {
  sendMessage: (jest.fn() as any).mockResolvedValue({
    text: 'This is a mock AI response about Nigerian tax reforms.',
  }),
};

export const mockGeminiAI = {
  chats: {
    create: jest.fn().mockReturnValue(mockChat),
  },
};

// Mock Logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock Environment Variables
export const mockEnvVars = {
  NODE_ENV: 'test',
  PORT: '5000',
  MONGO_URI: 'mongodb://localhost:27017/test',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  GEMINI_MODEL: 'gemini-2.0-flash-001',
  ORIGIN: 'http://localhost:3000',
};

// Reset all mocks
export const resetAllMocks = () => {
  mockRedisClient.get.mockReset();
  mockRedisClient.setEx.mockReset();
  mockRedisClient.disconnect.mockReset();
  mockRedisClient.quit.mockReset();
  mockRedisClient.connect.mockReset();
  mockChat.sendMessage.mockReset();
  mockLogger.info.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.debug.mockReset();
};
