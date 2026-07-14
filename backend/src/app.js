const crypto = require('crypto');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const poRoutes = require('./routes/po.routes');
const supplierRoutes = require('./routes/supplier.routes');

const authMiddleware = require('./middleware/auth');
const requireAdmin = require('./middleware/admin');
const { apiLimiter } = require('./middleware/rateLimiters');
const cacheService = require('./services/cache.service');
const { getGoogleAuth, spreadsheetId } = require('./config/google');

const parseTrustProxy = () => {
  const configured = process.env.TRUST_PROXY;
  if (configured === undefined || configured === '') {
    return process.env.NODE_ENV === 'production' ? 1 : false;
  }
  if (configured === 'false') return false;
  if (/^\d+$/.test(configured)) return Number(configured);
  throw new Error('TRUST_PROXY must be false or a non-negative integer');
};

const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy());

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const requestPath = req.path;
    const providedRequestId = req.headers['x-request-id'];
    const requestId = typeof providedRequestId === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(providedRequestId)
      ? providedRequestId
      : crypto.randomUUID();
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);

    res.on('finish', () => {
      if (process.env.NODE_ENV === 'test') return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(JSON.stringify({
        type: 'http_request',
        requestId,
        method: req.method,
        path: requestPath,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
      }));
    });
    next();
  });

  app.use(helmet());
  app.use(compression());

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS');
      error.status = 403;
      return callback(error);
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cache-Admin-Token', 'X-Request-Id'],
  }));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', apiLimiter, (req, res) => {
    res.json({ name: 'Akisto API', version: '1.1.0', status: 'running' });
  });

  app.get('/ready', (req, res) => {
    try {
      const auth = getGoogleAuth();
      if (!auth || !spreadsheetId) throw new Error('Google Sheets is not configured');
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  app.use('/api', apiLimiter);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  app.post('/api/cache/flush', authMiddleware, requireAdmin, (req, res) => {
    cacheService.flush();
    return res.json({ success: true, message: 'Cache flushed successfully' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/po', poRoutes);
  app.use('/api/supplier', supplierRoutes);

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
  });

  app.use((err, req, res, _next) => {
    console.error(JSON.stringify({
      type: 'unhandled_error',
      requestId: req.requestId,
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    }));

    const status = Number(err.status) || 500;
    const message = status >= 500 && process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred'
      : err.message;

    res.status(status).json({ success: false, message, requestId: req.requestId });
  });

  return app;
};

module.exports = { createApp };
