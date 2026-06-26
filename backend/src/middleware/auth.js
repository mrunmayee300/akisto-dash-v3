const authService = require('../services/auth.service');

const authMiddleware = (req, res, next) => {
  // Extract token from Authorization header, query parameter, or body
  let token = null;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.sessionToken) {
    token = req.query.sessionToken;
  } else if (req.body && req.body.sessionToken) {
    token = req.body.sessionToken;
  }

  const isAppsScript = req.query.action || req.body.action;
  const status = isAppsScript ? 200 : 401;

  if (!token) {
    return res.status(status).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access denied. No session token provided.'
    });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(status).json({
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
