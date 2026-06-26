const clientFilterMiddleware = (req, res, next) => {
  if (!req.user || !req.user.clientCode) {
    const isAppsScript = req.query.action || req.body.action;
    const status = isAppsScript ? 200 : 403;
    return res.status(status).json({
      success: false,
      error: 'Forbidden',
      message: 'Access denied. Client code not associated with user session.'
    });
  }

  // Inject clientCode filter into request query/body for downstream controllers to use
  req.clientCode = req.user.clientCode;
  next();
};

module.exports = clientFilterMiddleware;
