import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import errorMiddleware from '../../middleware/error.middleware.js';
import { mockLogger } from '../setup/mocks.js';
import { createMockRequest, createMockResponse, createMockNext } from '../setup/testHelpers.js';

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  default: mockLogger,
}));

describe('Error Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    mockLogger.error.mockClear();
    process.env.NODE_ENV = 'test';
  });

  it('should handle generic errors with default 500 status', () => {
    const error = new Error('Something went wrong');

    errorMiddleware(error as any, req as Request, res as Response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Something went wrong',
      expect.objectContaining({
        stack: expect.any(String),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Something went wrong',
    });
  });

  it('should use custom status code when provided', () => {
    const error: any = new Error('Bad request');
    error.statusCode = 400;

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Bad request',
    });
  });

  it('should handle CastError with 404 status', () => {
    const error: any = new Error('Cast failed');
    error.name = 'CastError';

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Resource not found',
    });
  });

  it('should handle duplicate key error (code 11000)', () => {
    const error: any = new Error('Duplicate key');
    error.code = 11000;

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Duplicate field value entered',
    });
  });

  it('should handle ValidationError with multiple errors', () => {
    const error: any = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = {
      email: { message: 'Email is required' },
      password: { message: 'Password is too short' },
    };

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('Email is required'),
    });
  });

  it('should handle JsonWebTokenError', () => {
    const error: any = new Error('jwt malformed');
    error.name = 'JsonWebTokenError';

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token',
    });
  });

  it('should handle TokenExpiredError', () => {
    const error: any = new Error('jwt expired');
    error.name = 'TokenExpiredError';

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Token expired',
    });
  });

  it('should include stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Development error');

    errorMiddleware(error as any, req as Request, res as Response, next);

    const callArgs = (res.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.stack).toBeDefined();
    expect(callArgs.stack).toContain('Error: Development error');
  });

  it('should NOT include stack trace in production mode', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Production error');

    errorMiddleware(error as any, req as Request, res as Response, next);

    const callArgs = (res.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.stack).toBeUndefined();
  });

  it('should log error code when present', () => {
    const error: any = new Error('Error with code');
    error.code = 11000;

    errorMiddleware(error, req as Request, res as Response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error with code',
      expect.objectContaining({
        code: 11000,
      })
    );
  });

  it('should use default message for errors without message', () => {
    const error: any = {};
    error.statusCode = 500;

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
    });
  });

  it('should always return success: false', () => {
    const error = new Error('Test error');

    errorMiddleware(error as any, req as Request, res as Response, next);

    const callArgs = (res.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.success).toBe(false);
  });

  it('should log errors with stack trace', () => {
    const error = new Error('Logged error');

    errorMiddleware(error as any, req as Request, res as Response, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Logged error',
      expect.objectContaining({
        stack: expect.stringContaining('Error: Logged error'),
      })
    );
  });

  it('should handle errors with statusCode 0', () => {
    const error: any = new Error('Edge case error');
    error.statusCode = 0;

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should prioritize specific error types over generic statusCode', () => {
    const error: any = new Error('CastError with custom code');
    error.name = 'CastError';
    error.statusCode = 400; // Should be overridden to 404

    errorMiddleware(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Resource not found',
    });
  });
});
