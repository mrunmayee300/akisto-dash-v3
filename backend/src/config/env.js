const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
};

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
};

const getJwtSecret = () => {
  const secret = getRequiredEnv('JWT_SECRET');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes long');
  }
  return secret;
};

const isMockDataEnabled = () => parseBoolean(process.env.ALLOW_MOCK_DATA, false);
const isLegacyPasswordEnabled = () => parseBoolean(process.env.ALLOW_LEGACY_PASSWORD_HASHES, false);
const isLegacyQueryAuthEnabled = () => parseBoolean(process.env.ALLOW_LEGACY_QUERY_AUTH, false);

const validatePositiveInteger = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const validateEnvironment = () => {
  getJwtSecret();
  validatePositiveInteger('API_RATE_LIMIT', 1200);
  validatePositiveInteger('LOGIN_RATE_LIMIT', 30);
  validatePositiveInteger('COMPANY_LOOKUP_RATE_LIMIT', 60);

  if (isProduction && isMockDataEnabled()) {
    throw new Error('ALLOW_MOCK_DATA must not be enabled in production');
  }

  if (isProduction) {
    getRequiredEnv('GOOGLE_SPREADSHEET_ID');
    getRequiredEnv('GOOGLE_PRIVATE_KEY');

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_CLIENT_EMAIL');
    }

    const origins = getRequiredEnv('CORS_ALLOWED_ORIGINS')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean);

    if (origins.length === 0 || origins.includes('*')) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain explicit origins in production');
    }

    origins.forEach(origin => {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
      if (parsed.origin !== origin || parsed.protocol !== 'https:') {
        throw new Error(`Production CORS origins must be exact HTTPS origins: ${origin}`);
      }
    });
  }
};

const timingSafeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

module.exports = {
  getJwtSecret,
  getRequiredEnv,
  isLegacyPasswordEnabled,
  isLegacyQueryAuthEnabled,
  isMockDataEnabled,
  isProduction,
  parseBoolean,
  timingSafeEqual,
  validateEnvironment,
};
