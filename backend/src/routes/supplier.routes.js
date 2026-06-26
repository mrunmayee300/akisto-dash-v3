const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const authMiddleware = require('../middleware/auth');
const clientFilterMiddleware = require('../middleware/clientFilter');

router.get('/', authMiddleware, clientFilterMiddleware, supplierController.getSuppliers);
router.get('/:supplierCode', authMiddleware, clientFilterMiddleware, supplierController.getSupplierByCode);

module.exports = router;
