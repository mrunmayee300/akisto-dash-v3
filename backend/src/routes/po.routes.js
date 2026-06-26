const express = require('express');
const router = express.Router();
const poController = require('../controllers/po.controller');
const authMiddleware = require('../middleware/auth');
const clientFilterMiddleware = require('../middleware/clientFilter');

router.get('/', authMiddleware, clientFilterMiddleware, poController.getPODetails);
router.get('/:commsGroupId', authMiddleware, clientFilterMiddleware, poController.getPODetails);

module.exports = router;
