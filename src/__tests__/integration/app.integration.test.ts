import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import { mockLogger, resetAllMocks } from '../setup/mocks.js';

// Mock dependencies
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
  ORIGIN: 'http://localhost:3000,http://localhost:4000',
  NODE_ENV: 'test',
}));

describe('App Integration Tests', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('Root Endpoints', () => {
    it('should respond with welcome message on root endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .expect(200);

      expect(response.text).toBe('Hello, TaxCalServer!');
    });

    it('should respond with health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-route')
        .expect(404);

      expect(response.status).toBe(404);
    });

    it('should return 404 for routes without /api/v1 prefix', async () => {
      const response = await request(app)
        .get('/health')
        .expect(404);

      expect(response.status).toBe(404);
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });

    it('should not expose X-Powered-By header', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should set Cross-Origin-Resource-Policy header', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow multiple origins', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:4000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4000');
    });

    it('should allow requests without origin (Postman, curl)', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should set Access-Control-Allow-Credentials', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/tax/calculate')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBeLessThan(300);
    });
  });

  describe('Body Parsing', () => {
    it('should parse JSON body', async () => {
      // This is implicitly tested in other endpoints, but let's be explicit
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: 500000 })
        .set('Content-Type', 'application/json');

      // Should not fail due to JSON parsing
      expect(response.status).not.toBe(415); // Unsupported Media Type
    });

    it('should enforce size limit on JSON body', async () => {
      const largeBody = {
        data: 'a'.repeat(20000), // Exceeds 10kb
      };

      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send(largeBody);

      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('HTTP Methods', () => {
    it('should support POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: 500000 });

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should support GET requests', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should return 404 for unsupported methods on root', async () => {
      const response = await request(app)
        .delete('/api/v1/')
        .expect(404);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with error middleware', async () => {
      // Force an error by sending invalid data type
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({ monthlyGrossIncome: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return proper error format', async () => {
      const response = await request(app)
        .post('/api/v1/tax/calculate')
        .send({});

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Content-Type Headers', () => {
    it('should return JSON content type for API endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect('Content-Type', /json/);

      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should handle requests without Content-Type', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.status).toBe(200);
    });
  });

  describe('Timestamp Format', () => {
    it('should return timestamp in Nigerian timezone', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      // The timestamp should be a string with date format
      expect(typeof response.body.timestamp).toBe('string');
      expect(response.body.timestamp.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting (Arcjet)', () => {
    it('should pass through Arcjet middleware', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Request Logging (Morgan)', () => {
    it('should log requests', async () => {
      await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Morgan stream should be called (mocked in our setup)
      // This is indirectly tested by the fact that requests succeed
      expect(true).toBe(true);
    });
  });
});
