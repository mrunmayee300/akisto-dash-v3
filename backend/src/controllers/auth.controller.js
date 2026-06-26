const authService = require('../services/auth.service');
const sheetsService = require('../services/sheets.service');

const authController = {
  checkCompany: async (req, res) => {
    const companyName = req.query.companyName || req.body.companyName;
    if (!companyName) {
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
               (name3 && name3 === inputName) ||
               (name1 && name1.includes(inputName)) ||
               (name3 && name3.includes(inputName));
      });

      return res.json({
        success: !!foundClient,
        companyName: foundClient ? (foundClient.client_company_name || foundClient.company_name || foundClient.client_company_name_full) : null
      });
    } catch (error) {
      console.error('Error checking company:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  login: async (req, res) => {
    const { email, password, companyName } = req.body;
    
    // Support query parameters for backwards compatibility
    const loginEmail = email || req.query.email;
    const loginPassword = password || req.query.password;
    const loginCompany = companyName || req.query.companyName;

    if (!loginEmail || !loginPassword || !loginCompany) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and company name are required'
      });
    }

    try {
      const result = await authService.authenticateUser(loginEmail, loginPassword, loginCompany);
      return res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Authentication failed'
      });
    }
  },

  me: async (req, res) => {
    try {
      // req.user is attached by authMiddleware
      return res.json({
        success: true,
        user: {
          userId: req.user.userId,
          email: req.user.email,
          clientCode: req.user.clientCode,
          role: req.user.role
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
