const { timingSafeEqual } = require('../config/env');

const requireAdmin = (req, res, next) => {
  const configuredToken = process.env.CACHE_ADMIN_TOKEN;
  const providedToken = req.headers['x-cache-admin-token'];
  const isAdminRole = String(req.user?.role || '').trim().toLowerCase() === 'admin';

  if (!configuredToken) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  if (!isAdminRole || !timingSafeEqual(providedToken, configuredToken)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  return next();
};

module.exports = requireAdmin;
