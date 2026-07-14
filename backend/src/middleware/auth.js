const authService = require('../services/auth.service');
const { isLegacyQueryAuthEnabled } = require('../config/env');

const authMiddleware = (req, res, next) => {
  // Authorization headers are the only supported production transport.
  let token = null;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (isLegacyQueryAuthEnabled() && req.query && req.query.sessionToken) {
    token = req.query.sessionToken;
  } else if (isLegacyQueryAuthEnabled() && req.body && req.body.sessionToken) {
    token = req.body.sessionToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access denied. No session token provided.'
    });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access denied. Invalid or expired session token.'
    });
  }

  // Attach user information to the request object
  req.user = decoded;
  next();
};

module.exports = authMiddleware;
