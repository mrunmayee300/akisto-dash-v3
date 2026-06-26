const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const supplierController = {
  getSuppliers: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('suppliers', clientCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const supplierRows = await sheetsService.getSheetObjects('Material and Supplier Master Data');
      
      // If we want to filter suppliers by clientCode, we can filter by client_buyer_email or client_buyer_name if it maps to client,
      // or return all suppliers. Let's return all suppliers for now or filter if there is a clear mapping.
      const suppliers = supplierRows.map(supplier => ({
        supplierCode: supplier.supplier_code,
        supplierName: supplier.supplier_name,
        contactName: supplier.primary_contact_names,
        email: supplier.primary_emails,
        phone: supplier.primary_phones,
        workingDays: supplier.working_days,
        sourceLocation: supplier.supplier_source_location,
        deliveryLocation: supplier.delivery_location,
        buyerName: supplier.client_buyer_name,
        buyerEmail: supplier.client_buyer_email
      }));

      cacheService.set(cacheKey, suppliers, 60); // Cache suppliers for 60s
      return res.json(suppliers);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load suppliers.'
      });
    }
  },

  getSupplierByCode: async (req, res) => {
    const supplierCode = req.query.supplierCode || req.params.supplierCode;

    if (!supplierCode) {
      return res.status(400).json({
        success: false,
        message: 'supplierCode is required'
      });
    }

    const cacheKey = cacheService.generateKey('supplier_detail', null, supplierCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const supplierRows = await sheetsService.getSheetObjects('Material and Supplier Master Data');
      const foundSupplier = supplierRows.find(s => normalize(s.supplier_code) === normalize(supplierCode));

      if (!foundSupplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }

      const supplier = {
        supplierCode: foundSupplier.supplier_code,
        supplierName: foundSupplier.supplier_name,
        contactName: foundSupplier.primary_contact_names,
        email: foundSupplier.primary_emails,
        phone: foundSupplier.primary_phones,
        workingDays: foundSupplier.working_days,
        sourceLocation: foundSupplier.supplier_source_location,
        deliveryLocation: foundSupplier.delivery_location,
        buyerName: foundSupplier.client_buyer_name,
        buyerEmail: foundSupplier.client_buyer_email
      };

      cacheService.set(cacheKey, supplier, 60);
      return res.json(supplier);
    } catch (error) {
      console.error(`Error loading supplier ${supplierCode}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load supplier details.'
      });
    }
  }
};

module.exports = supplierController;
