const rateLimit = require('express-rate-limit');

// General API rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different limits for different endpoints
const limits = {
  // Auth endpoints - more restrictive
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts, please try again later.'
  ),
  
  // General API endpoints
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests per window
    'Too many requests, please try again later.'
  ),
  
  // Search endpoints - more restrictive due to database load
  search: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many search requests, please try again later.'
  ),
  
  // Create operations - restrictive to prevent spam
  create: createRateLimit(
    60 * 60 * 1000, // 1 hour
    50, // 50 creations per hour
    'Too many creation attempts, please try again later.'
  )
};

module.exports = limits;