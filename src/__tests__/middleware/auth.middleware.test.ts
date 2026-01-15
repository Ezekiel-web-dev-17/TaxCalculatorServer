import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Response, NextFunction } from 'express';
import { authMiddleware, type AuthRequest } from '../../middleware/auth.middleware.js';
import jwt from 'jsonwebtoken';
import { createMockResponse, createMockNext } from '../setup/testHelpers.js';

const TEST_JWT_SECRET = 'test-jwt-secret-key';

// Mock environment config
jest.mock('../../config/env.config.js', () => ({
  JWT_SECRET: TEST_JWT_SECRET,
}));

describe('Auth Middleware', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = createMockResponse();
    next = createMockNext();
  });

  it('should authenticate valid JWT token', () => {
    const payload = { userId: 'user123', email: 'test@example.com' };
    const token = jwt.sign(payload, TEST_JWT_SECRET);
    req.headers = { authorization: `Bearer ${token}` };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('user123');
    expect(req.user?.email).toBe('test@example.com');
    expect(next).toHaveBeenCalledWith();
  });

  it('should return 401 when no authorization header is present', () => {
    req.headers = {};

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    req.headers = { authorization: 'Invalid token-here' };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Bearer token is missing', () => {
    req.headers = { authorization: 'Bearer ' };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Malformed token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is only whitespace', () => {
    req.headers = { authorization: 'Bearer    ' };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Malformed token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with error for invalid token', () => {
    req.headers = { authorization: 'Bearer invalid.token.here' };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with error for expired token', () => {
    const payload = { userId: 'user123', email: 'test@example.com' };
    const expiredToken = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1h' });
    req.headers = { authorization: `Bearer ${expiredToken}` };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next with error for token signed with wrong secret', () => {
    const payload = { userId: 'user123', email: 'test@example.com' };
    const wrongSecretToken = jwt.sign(payload, 'wrong-secret');
    req.headers = { authorization: `Bearer ${wrongSecretToken}` };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle token with additional claims', () => {
    const payload = {
      userId: 'user123',
      email: 'test@example.com',
      role: 'admin',
      customClaim: 'value',
    };
    const token = jwt.sign(payload, TEST_JWT_SECRET);
    req.headers = { authorization: `Bearer ${token}` };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('user123');
    expect(next).toHaveBeenCalledWith();
  });

  it('should handle case variations in Bearer prefix', () => {
    const payload = { userId: 'user123', email: 'test@example.com' };
    const token = jwt.sign(payload, TEST_JWT_SECRET);

    // Test with lowercase 'bearer'
    req.headers = { authorization: `bearer ${token}` };
    authMiddleware(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
  });

  it('should not mutate request object on authentication failure', () => {
    req.headers = { authorization: 'Bearer invalid.token' };
    const originalReq = { ...req };

    authMiddleware(req as AuthRequest, res as Response, next);

    expect(req.user).toBeUndefined();
  });
});
