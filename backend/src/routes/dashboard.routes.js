const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth');
const clientFilterMiddleware = require('../middleware/clientFilter');

router.get('/', authMiddleware, clientFilterMiddleware, dashboardController.getDashboardData);
router.get('/summary', authMiddleware, clientFilterMiddleware, dashboardController.getSummary);

module.exports = router;
