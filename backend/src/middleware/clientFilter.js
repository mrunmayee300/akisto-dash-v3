const clientFilterMiddleware = (req, res, next) => {
  if (!req.user || !req.user.clientCode) {
    return res.status(403).json({
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
