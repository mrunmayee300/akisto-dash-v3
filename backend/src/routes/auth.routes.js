const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const { companyLookupLimiter, loginLimiter } = require('../middleware/rateLimiters');

router.get('/check-company', companyLookupLimiter, authController.checkCompany);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
