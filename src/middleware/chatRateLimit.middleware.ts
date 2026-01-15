import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for AI chat endpoint
 * Limits: 10 requests per 5 minutes per IP address
 */
export const chatRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many chat requests from this IP. Please try again after 5 minutes.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: 429, // HTTP status code for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many chat requests from this IP. Please try again after 5 minutes.',
      retryAfter: Math.ceil(req.rateLimit?.resetTime?.getDate()! / 1000), // Retry after timestamp
    });
  },
});
