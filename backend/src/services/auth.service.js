const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sheetsService = require('./sheets.service');

const JWT_SECRET = process.env.JWT_SECRET || 'akisto_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const hashPasswordSha256 = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const authService = {
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 10);
  },

  verifyPassword: async (password, storedHash) => {
    if (!storedHash) return false;
    
    // 1. Try bcrypt comparison
    try {
      if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
        const match = await bcrypt.compare(password, storedHash);
        if (match) return true;
      }
    } catch (error) {
      console.warn('Bcrypt comparison failed, falling back to SHA-256:', error);
    }

    // 2. Fallback to SHA-256 or plain text comparison
    const sha256Hash = hashPasswordSha256(password);
    return storedHash === sha256Hash || storedHash === password;
  },

  generateToken: (user) => {
    const payload = {
      userId: user.user_id,
      email: user.email,
      clientCode: user.client_code,
      role: user.role,
      userName: user['User Name'] || user.userName || '',
      userRole: user['Role'] || user.userRole || ''
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  },

  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  },

  authenticateUser: async (email, password, companyName) => {
    // 1. Get client mapping and find client by company name
    const clients = await sheetsService.getSheetObjects('Client info');
    const foundClient = clients.find(c => {
      const name1 = String(c.client_company_name || '').trim().toLowerCase();
      const name2 = String(c.company_name || '').trim().toLowerCase();
      const name3 = String(c.client_company_name_full || '').trim().toLowerCase();
      const inputName = String(companyName || '').trim().toLowerCase();

      return (name1 && name1 === inputName) ||
             (name2 && name2 === inputName) ||
             (name3 && name3 === inputName) ||
             (name1 && name1.includes(inputName)) ||
             (name3 && name3.includes(inputName));
    });

    if (!foundClient) {
      throw new Error('Company not found');
    }

    const clientCode = foundClient.client_code;

    // 2. Get users and find user by email, clientCode, and active status
    const users = await sheetsService.getSheetObjects('Users');
    const foundUser = users.find(u => {
      const uEmail = String(u.email || '').trim().toLowerCase();
      const inputEmail = String(email || '').trim().toLowerCase();
      if (uEmail !== inputEmail) return false;

      const uClient = String(u.client_code || '').trim();
      const clientMatch = (uClient === clientCode);

      const uActive = String(u.active || '').trim().toUpperCase();
      const activeMatch = (uActive === 'TRUE' || uActive === 'YES' || uActive === 'Y' || uActive === '1' || uActive === '');

      return clientMatch && activeMatch;
    });

    if (!foundUser) {
      throw new Error('Invalid email, password, or company combination');
    }

    // 3. Verify password hash
    const storedHash = u => u.password_hash || u.password || u.password_hash_;
    const isPasswordValid = await authService.verifyPassword(password, foundUser.password_hash || foundUser.password || foundUser.password_hash_);

    if (!isPasswordValid) {
      throw new Error('Invalid email, password, or company combination');
    }

    // 4. Generate JWT
    const token = authService.generateToken(foundUser);

    return {
      success: true,
      token,
      email: foundUser.email,
      role: foundUser.role,
      userName: foundUser['User Name'] || foundUser.userName || '',
      userRole: foundUser['Role'] || foundUser.userRole || '',
      companyName: foundClient.client_company_name || foundClient.company_name || foundClient.client_company_name_full
    };
  }
};

module.exports = authService;
