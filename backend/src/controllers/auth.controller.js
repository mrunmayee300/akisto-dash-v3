const authService = require('../services/auth.service');
const sheetsService = require('../services/sheets.service');
const { isLegacyQueryAuthEnabled } = require('../config/env');

const normalizeInput = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const authController = {
  checkCompany: async (req, res) => {
    const body = req.body || {};
    const companyName = normalizeInput(req.query.companyName || body.companyName, 120);
    if (companyName.length < 2) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }

    try {
      const clients = await sheetsService.getSheetObjects('Client info');
      const foundClient = clients.find(c => {
        const name1 = String(c.client_company_name || '').trim().toLowerCase();
        const name2 = String(c.company_name || '').trim().toLowerCase();
        const name3 = String(c.client_company_name_full || '').trim().toLowerCase();
        const inputName = String(companyName).trim().toLowerCase();

        return (name1 && name1 === inputName) ||
               (name2 && name2 === inputName) ||
               (name3 && name3 === inputName);
      });

      return res.json({
        success: !!foundClient,
        companyName: foundClient ? (foundClient.client_company_name || foundClient.company_name || foundClient.client_company_name_full) : null
      });
    } catch (error) {
      console.error('Error checking company:', error);
      const status = error.status === 503 ? 503 : 500;
      const message = status === 503 ? 'Company lookup is temporarily unavailable' : 'Internal server error';
      return res.status(status).json({ success: false, message });
    }
  },

  login: async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const body = req.body || {};
    const legacyQuery = isLegacyQueryAuthEnabled() ? req.query : {};
    const loginEmail = normalizeInput(body.email || legacyQuery.email, 254).toLowerCase();
    const loginPassword = typeof (body.password || legacyQuery.password) === 'string'
      ? (body.password || legacyQuery.password)
      : '';
    const loginCompany = normalizeInput(body.companyName || legacyQuery.companyName, 120);

    if (!isValidEmail(loginEmail) || loginPassword.length < 8 || loginPassword.length > 256 || loginCompany.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid email, password, and company name are required'
      });
    }

    try {
      const result = await authService.authenticateUser(loginEmail, loginPassword, loginCompany);
      return res.json(result);
    } catch (error) {
      if (error.code === 'SHEETS_UNAVAILABLE') {
        console.error('Login dependency error:', error.message);
        return res.status(503).json({ success: false, message: 'Authentication service is temporarily unavailable' });
      }
      console.warn('Login rejected:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid email, password, or company combination'
      });
    }
  },

  me: async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      // req.user is attached by authMiddleware
      return res.json({
        success: true,
        user: {
          userId: req.user.userId,
          email: req.user.email,
          clientCode: req.user.clientCode,
          role: req.user.role,
          userName: req.user.userName || '',
          userRole: req.user.userRole || ''
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  logout: async (req, res) => {
    // JWT is stateless, so we just return success.
    // Client-side will remove the token from localStorage.
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

module.exports = authController;
