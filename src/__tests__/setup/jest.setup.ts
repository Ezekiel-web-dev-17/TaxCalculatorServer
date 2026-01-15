// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.GEMINI_MODEL = 'gemini-2.0-flash-001';
process.env.ORIGIN = 'http://localhost:3000';
process.env.ARCJET_KEY = 'test-arcjet-key';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
