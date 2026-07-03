const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const poRoutes = require('./routes/po.routes');
const supplierRoutes = require('./routes/supplier.routes');

const authController = require('./controllers/auth.controller');
const dashboardController = require('./controllers/dashboard.controller');
const poController = require('./controllers/po.controller');
const authMiddleware = require('./middleware/auth');
const clientFilterMiddleware = require('./middleware/clientFilter');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// CORS Configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowed => {
      const cleanAllowed = allowed.toLowerCase();
      const cleanOrigin = origin.toLowerCase();
      return cleanAllowed === '*' || cleanOrigin === cleanAllowed;
    });

    const isVercelPreview = origin.endsWith('.vercel.app');

    if (isAllowed || isVercelPreview || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api/', apiLimiter);

// ===================================================================
// BACKWARDS COMPATIBILITY LAYER (Apps Script query action mapping)
// ===================================================================
app.all(['/', '/api'], (req, res, next) => {
  const action = req.query.action || req.body.action;
  if (!action) {
    if (req.path === '/') {
      return res.json({
        name: 'Akisto API',
        version: '1.0.0',
        status: 'running'
      });
    }
    return next(); // Fall through to standard RESTful routes
  }

  console.log(`[Compatibility Layer] Intercepted Apps Script action: ${action}`);

  // Public Actions
  if (action === 'checkCompany') {
    return authController.checkCompany(req, res);
  }
  if (action === 'login') {
    return authController.login(req, res);
  }

  // Protected Actions (require authentication and client filtering)
  return authMiddleware(req, res, () => {
    return clientFilterMiddleware(req, res, () => {
      if (action === 'dashboard') {
        return dashboardController.getDashboardData(req, res);
      }
      if (action === 'poDetails') {
        return poController.getPODetails(req, res);
      }
      return res.status(400).json({
        success: false,
        message: `Unknown action: ${action}`
      });
    });
  });
});

// Cache Flush Endpoint
app.post('/api/cache/flush', (req, res) => {
  const cacheService = require('./services/cache.service');
  cacheService.flush();
  console.log('[Cache Flush] Memory cache flushed successfully.');
  return res.json({
    success: true,
    message: 'Cache flushed successfully'
  });
});

// Standard RESTful Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/po', poRoutes);
app.use('/api/supplier', supplierRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  // Do not leak internal details to the client in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'An internal server error occurred' 
    : err.message;

  res.status(err.status || 500).json({
    success: false,
    message
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Akisto Backend Server is running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please free up the port or set a different PORT in backend/.env`);
    process.exit(1);
  } else {
    throw err;
  }
});
