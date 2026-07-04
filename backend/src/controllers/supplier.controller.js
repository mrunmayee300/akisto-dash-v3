const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const formatMonth = (monthVal) => {
  if (!monthVal) return '';
  const str = String(monthVal).trim();
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  return str;
};

const supplierController = {
  getSuppliers: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('suppliers_performance', clientCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const sheetsData = await sheetsService.getMultipleSheetsObjects([
        'Supplier Stats',
        'Supplier Monthly Stats',
        'Delay Event Logs'
      ]);

      const supplierStatsRows = sheetsData['Supplier Stats'] || [];
      const supplierMonthlyStatsRows = sheetsData['Supplier Monthly Stats'] || [];
      const delayEventLogsRows = sheetsData['Delay Event Logs'] || [];

      // Filter Supplier Stats by client_code
      const filteredSuppliers = supplierStatsRows.filter(
        s => normalize(s.client_code) === normalize(clientCode)
      );

      // Map rows for the Reliability Table
      const suppliers = filteredSuppliers.map(s => {
        const onTimeRate = parseFloat(s.on_time_rate || 0);
        let rateClass = 'good';
        if (onTimeRate < 0.6) {
          rateClass = 'bad';
        } else if (onTimeRate < 0.8) {
          rateClass = 'mid';
        }

        return {
          name: s.supplier_name || s.supplier_name_full || 'Unknown Supplier',
          code: s.supplier_code,
          desc: s.category || '',
          poLines: parseInt(s.total_po_lines || 0, 10),
          onTime: Math.round(onTimeRate * 100),
          avgDaysLate: parseFloat(s.avg_days_late || 0).toFixed(1),
          avgRespTime: parseFloat(s.avg_response_time_days || 0).toFixed(1) + ' d',
          escalated: Math.round(parseFloat(s.escalated_rate || 0) * 100) + '%',
          flag: s.performance_flag || '',
          rateClass: rateClass
        };
      });

      // Sort suppliers: good/mid/bad ranked by on-time rate descending (strongest first)
      suppliers.sort((a, b) => b.onTime - a.onTime);

      // Compute Overall KPIs
      let totalPoLines = 0;
      let totalOnTimeLines = 0;
      let totalEscalatedLines = 0;

      filteredSuppliers.forEach(s => {
        totalPoLines += parseInt(s.total_po_lines || 0, 10);
        totalOnTimeLines += parseInt(s.on_time_lines || 0, 10);
        totalEscalatedLines += parseInt(s.escalated_lines || 0, 10);
      });

      const onTimeRateOverall = totalPoLines > 0 ? Math.round((totalOnTimeLines / totalPoLines) * 100) : 100;
      const escalatedRateOverall = totalPoLines > 0 ? Math.round((totalEscalatedLines / totalPoLines) * 100) : 0;
      const supplierCount = filteredSuppliers.length;

      const kpis = {
        onTimeRate: onTimeRateOverall,
        escalatedRate: escalatedRateOverall,
        totalPoLines: totalPoLines,
        supplierCount: supplierCount
      };

      // Filter Trend Data (GLOBAL trend line)
      const trendData = supplierMonthlyStatsRows
        .filter(row => normalize(row.client_code) === normalize(clientCode) && normalize(row.supplier_code) === 'GLOBAL')
        .map(row => ({
          month: formatMonth(row.month),
          rate: Math.round(parseFloat(row.on_time_rate || 0) * 100)
        }));

      trendData.sort((a, b) => normalize(a.month).localeCompare(normalize(b.month)));

      // Filter Delay Summary dynamically (GLOBAL causes)
      const filteredDelays = delayEventLogsRows.filter(
        row => normalize(row.client_code) === normalize(clientCode)
      );
      const totalDelays = filteredDelays.length;
      const delayCounts = {};
      const delaySides = {};
      filteredDelays.forEach(row => {
        const cat = row.delay_reason_category || 'Unknown';
        delayCounts[cat] = (delayCounts[cat] || 0) + 1;
        delaySides[cat] = row.delay_origin || 'supplier';
      });
      const delaySummary = Object.keys(delayCounts).map(cat => ({
        category: cat,
        side: delaySides[cat],
        count: delayCounts[cat],
        percentage: totalDelays > 0 ? Math.round((delayCounts[cat] / totalDelays) * 100) : 0
      })).sort((a, b) => b.percentage - a.percentage);

      const responseData = {
        success: true,
        suppliers,
        kpis,
        trendData,
        delaySummary
      };

      cacheService.set(cacheKey, responseData, 5); // Cache for 5s
      return res.json(responseData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load suppliers.'
      });
    }
  },

  getSupplierByCode: async (req, res) => {
    const clientCode = req.clientCode;
    const supplierCode = req.query.supplierCode || req.params.supplierCode;

    if (!supplierCode) {
      return res.status(400).json({
        success: false,
        message: 'supplierCode is required'
      });
    }

    const cacheKey = cacheService.generateKey('supplier_detail', clientCode, supplierCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const sheetsData = await sheetsService.getMultipleSheetsObjects([
        'Supplier Stats',
        'Supplier Monthly Stats',
        'Delay Event Logs',
        'Communication Logs'
      ]);

      const supplierStatsRows = sheetsData['Supplier Stats'] || [];
      const supplierMonthlyStatsRows = sheetsData['Supplier Monthly Stats'] || [];
      const delayEventLogsRows = sheetsData['Delay Event Logs'] || [];
      const communicationLogs = sheetsData['Communication Logs'] || [];

      // Find Supplier Stats entry
      const foundSupplier = supplierStatsRows.find(
        s => normalize(s.client_code) === normalize(clientCode) && 
             normalize(s.supplier_code) === normalize(supplierCode)
      );

      if (!foundSupplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier performance stats not found'
        });
      }

      const onTimeRate = parseFloat(foundSupplier.on_time_rate || 0);

      const supplierMeta = {
        name: foundSupplier.supplier_name || foundSupplier.supplier_name_full || 'Unknown Supplier',
        code: foundSupplier.supplier_code,
        cat: `${foundSupplier.total_po_lines} PO lines over the trailing 6 months · primary contact on file`,
        flag: foundSupplier.performance_flag || '',
        contact: foundSupplier.contact_name || '--',
        email: foundSupplier.email || '--',
        phone: foundSupplier.phone || '--',
        location: foundSupplier.source_location || '--'
      };

      const kpis = {
        onTimeRate: Math.round(onTimeRate * 100) + '%',
        avgDaysLate: parseFloat(foundSupplier.avg_days_late || 0).toFixed(1),
        avgRespTime: parseFloat(foundSupplier.avg_response_time_days || 0).toFixed(1) + ' d',
        escalatedRate: Math.round(parseFloat(foundSupplier.escalated_rate || 0) * 100) + '%'
      };

      // Trend Data
      const trendData = supplierMonthlyStatsRows
        .filter(row => normalize(row.client_code) === normalize(clientCode) && 
                       normalize(row.supplier_code) === normalize(supplierCode))
        .map(row => ({
          month: formatMonth(row.month),
          rate: Math.round(parseFloat(row.on_time_rate || 0) * 100)
        }));

      trendData.sort((a, b) => normalize(a.month).localeCompare(normalize(b.month)));

      // Delay Summary dynamically (supplier-specific causes)
      const filteredDelays = delayEventLogsRows.filter(
        row => normalize(row.client_code) === normalize(clientCode) &&
               normalize(row.supplier_code) === normalize(supplierCode)
      );
      const totalDelays = filteredDelays.length;
      const delayCounts = {};
      const delaySides = {};
      filteredDelays.forEach(row => {
        const cat = row.delay_reason_category || 'Unknown';
        delayCounts[cat] = (delayCounts[cat] || 0) + 1;
        delaySides[cat] = row.delay_origin || 'supplier';
      });
      const delaySummary = Object.keys(delayCounts).map(cat => ({
        category: cat,
        side: delaySides[cat],
        count: delayCounts[cat],
        percentage: totalDelays > 0 ? Math.round((delayCounts[cat] / totalDelays) * 100) : 0
      })).sort((a, b) => b.percentage - a.percentage);

      // Recent Deliveries
      // Filter logs by client_code, supplier_code, and status === 'Closed'
      const recentDeliveries = communicationLogs
        .filter(log => normalize(log.client_code) === normalize(clientCode) && 
                       normalize(log.supplier_code) === normalize(supplierCode) && 
                       normalize(log['PO line item status']).toLowerCase() === 'closed')
        .map(log => {
          const variance = parseInt(log.delivery_variance_days || 0, 10);
          
          // Resolve delivery date: reply timestamp of the final stage that marked it closed
          let deliveryDate = log.stage3_reply_timestamp || 
                             log.stage2_5_reply_timestamp || 
                             log.stage2_reply_timestamp || 
                             log.stage1_5_reply_timestamp || 
                             log.stage1_reply_timestamp || 
                             '';

          return {
            po: log.po_number || '--',
            materialName: log.material_name || '--',
            materialCode: log.material_code || '',
            needBy: log.deliver_by_date || '',
            delivered: deliveryDate,
            daysLate: variance,
            outcome: variance <= 0 ? 'On time' : 'Delayed',
            commsGroupId: log.comms_group_id || ''
          };
        });

      // Sort recent deliveries: most recent needBy date first
      recentDeliveries.sort((a, b) => new Date(b.needBy) - new Date(a.needBy));

      const responseData = {
        success: true,
        supplierMeta,
        kpis,
        trendData,
        delaySummary,
        recentDeliveries
      };

      cacheService.set(cacheKey, responseData, 5); // Cache for 5s
      return res.json(responseData);
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
