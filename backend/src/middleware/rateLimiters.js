const rateLimit = require('express-rate-limit');

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 1200),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const loginLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 30),
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again later.',
  },
});

const companyLookupLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.COMPANY_LOOKUP_RATE_LIMIT || 60),
  message: {
    success: false,
    message: 'Too many company lookup attempts. Please try again later.',
  },
});

module.exports = { apiLimiter, companyLookupLimiter, loginLimiter };
