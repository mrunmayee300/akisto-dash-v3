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

const getThresholdMonth = (latestMonthStr, numMonths = 6) => {
  if (!latestMonthStr || !latestMonthStr.includes('-')) return '';
  const parts = latestMonthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const d = new Date(year, month - numMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const supplierController = {
  getSuppliers: async (req, res) => {
    const clientCode = req.clientCode;
    const userEmail = req.user && req.user.email || '';
    const cacheKey = cacheService.generateKey('suppliers_performance', clientCode, userEmail);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const sheetsData = await sheetsService.getMultipleSheetsObjects([
        'Supplier Stats',
        'Supplier Monthly Stats',
        'Delay Event Logs',
        'Client info',
        'Client Stats'
      ], clientCode);

      const supplierStatsRows = sheetsData['Supplier Stats'] || [];
      const supplierMonthlyStatsRows = sheetsData['Supplier Monthly Stats'] || [];
      const delayEventLogsRows = sheetsData['Delay Event Logs'] || [];
      const clientInfoRows = sheetsData['Client info'] || [];
      const clientStatsRows = sheetsData['Client Stats'] || [];

      // Resolve buyer name from Client info or req.user
      const loggedInEmail = String(userEmail).trim().toLowerCase();
      const loggedInName = String(req.user && req.user.userName || '').trim().toLowerCase();

      const clientBuyerRow = clientInfoRows.find(c => 
        normalize(c.client_code) === normalize(clientCode) && 
        (String(c.buyer_email || c.ai_agent_buyer_email || '').trim().toLowerCase() === loggedInEmail ||
         String(c.buyer_name || c.ai_agent_buyer_name || '').trim().toLowerCase() === loggedInName)
      );

      let buyerNameFilter = '';
      if (clientBuyerRow) {
        buyerNameFilter = clientBuyerRow.buyer_name || clientBuyerRow.ai_agent_buyer_name || '';
      }

      let filteredSuppliers = supplierStatsRows.filter(
        s => normalize(s.client_code) === normalize(clientCode)
      );

      // Apply buyer filtering
      if (buyerNameFilter) {
        const checkFiltered = filteredSuppliers.filter(
          s => normalize(s.buyer_name).toLowerCase() === buyerNameFilter.toLowerCase()
        );
        if (checkFiltered.length > 0) {
          filteredSuppliers = checkFiltered;
        }
      } else if (loggedInName) {
        const checkFiltered = filteredSuppliers.filter(
          s => normalize(s.buyer_name).toLowerCase() === loggedInName
        );
        if (checkFiltered.length > 0) {
          filteredSuppliers = checkFiltered;
        }
      }

      // Map rows for the Reliability Table
      const suppliers = filteredSuppliers.map(s => {
        const rawOnTime = parseFloat(s.on_time_rate || 0);
        const isWholeNumber = rawOnTime > 1.5;
        const onTimeRate = isWholeNumber ? (rawOnTime / 100) : rawOnTime;
        const escalatedRate = isWholeNumber ? (parseFloat(s.escalated_rate || 0) / 100) : parseFloat(s.escalated_rate || 0);

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
          escalated: Math.round(escalatedRate * 100) + '%',
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

      const clientStatRow = clientStatsRows.find(
        cs => normalize(cs.client_code) === normalize(clientCode)
      );

      const kpis = {
        onTimeRate: onTimeRateOverall,
        onTimeRateDelta: clientStatRow ? parseFloat(clientStatRow.client_otr_6months || 0) : 0,
        escalatedRate: escalatedRateOverall,
        escalatedRateDelta: clientStatRow ? parseFloat(clientStatRow.client_escalation_6months || 0) : 0,
        totalPoLines: totalPoLines,
        supplierCount: supplierCount
      };

      // Filter Trend Data (Dynamic buyer-scoped monthly OTR)
      const assignedSupplierCodes = new Set(filteredSuppliers.map(s => normalize(s.supplier_code)));
      const monthlyAggregates = {};
      
      supplierMonthlyStatsRows.forEach(row => {
        const sCode = normalize(row.supplier_code);
        const cCode = normalize(row.client_code);
        if (cCode === normalize(clientCode) && assignedSupplierCodes.has(sCode)) {
          const month = formatMonth(row.month);
          if (!monthlyAggregates[month]) {
            monthlyAggregates[month] = { onTime: 0, total: 0 };
          }
          monthlyAggregates[month].onTime += parseInt(row.on_time_lines || 0, 10);
          monthlyAggregates[month].total += parseInt(row.total_po_lines || 0, 10);
        }
      });

      let trendData = Object.keys(monthlyAggregates).map(month => {
        const agg = monthlyAggregates[month];
        return {
          month,
          rate: agg.total > 0 ? Math.round((agg.onTime / agg.total) * 100) : 100
        };
      });

      // Fallback to GLOBAL trend line if buyer-specific trend is empty
      if (trendData.length === 0) {
        trendData = supplierMonthlyStatsRows
          .filter(row => normalize(row.client_code) === normalize(clientCode) && normalize(row.supplier_code) === 'GLOBAL')
          .map(row => {
            const rawRate = parseFloat(row.on_time_rate || 0);
            const rate = rawRate > 1.5 ? (rawRate / 100) : rawRate;
            return {
              month: formatMonth(row.month),
              rate: Math.round(rate * 100)
            };
          });
      }

      trendData.sort((a, b) => normalize(a.month).localeCompare(normalize(b.month)));

      if (trendData.length > 0) {
        const latestMonth = trendData.reduce((max, d) => d.month > max ? d.month : max, '0000-00');
        const thresholdMonth = getThresholdMonth(latestMonth, 6);
        trendData = trendData.filter(d => d.month >= thresholdMonth);
      }

      // Filter Delay Summary dynamically (buyer-scoped causes)
      const filteredDelays = delayEventLogsRows.filter(
        row => normalize(row.client_code) === normalize(clientCode) && 
               assignedSupplierCodes.has(normalize(row.supplier_code))
      );
      
      const delaysToUse = filteredDelays.length > 0 ? filteredDelays : delayEventLogsRows.filter(
        row => normalize(row.client_code) === normalize(clientCode)
      );

      const totalDelays = delaysToUse.length;
      const delayCounts = {};
      const delaySides = {};
      delaysToUse.forEach(row => {
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

      cacheService.set(cacheKey, responseData, 60); // Cache for 60s
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
      ], clientCode);

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

      const rawOnTime = parseFloat(foundSupplier.on_time_rate || 0);
      const isWholeNumber = rawOnTime > 1.5;
      const onTimeRate = isWholeNumber ? (rawOnTime / 100) : rawOnTime;
      const escalatedRate = isWholeNumber ? (parseFloat(foundSupplier.escalated_rate || 0) / 100) : parseFloat(foundSupplier.escalated_rate || 0);

      const supplierMeta = {
        name: foundSupplier.supplier_name || foundSupplier.supplier_name_full || 'Unknown Supplier',
        code: foundSupplier.supplier_code,
        cat: `${foundSupplier.total_po_lines} PO lines over the trailing 6 months`,
        flag: foundSupplier.performance_flag || '',
        contact: foundSupplier.contact_name || '--',
        email: foundSupplier.email || '--',
        phone: foundSupplier.phone || '--',
        location: foundSupplier.source_location || '--'
      };

      const kpis = {
        onTimeRate: Math.round(onTimeRate * 100) + '%',
        onTimeRateDelta: parseFloat(foundSupplier.supplier_otr_6months || 0),
        avgDaysLate: parseFloat(foundSupplier.avg_days_late || 0).toFixed(1),
        avgRespTime: parseFloat(foundSupplier.avg_response_time_days || 0).toFixed(1) + ' d',
        escalatedRate: Math.round(escalatedRate * 100) + '%',
        escalatedRateDelta: parseFloat(foundSupplier.supplier_escalation_6months || 0)
      };

      // Trend Data for Selected Supplier
      let trendData = supplierMonthlyStatsRows
        .filter(row => normalize(row.client_code) === normalize(clientCode) && 
                       normalize(row.supplier_code) === normalize(supplierCode))
        .map(row => {
          const rawRate = parseFloat(row.on_time_rate || 0);
          const rate = rawRate > 1.5 ? (rawRate / 100) : rawRate;
          return {
            month: formatMonth(row.month),
            rate: Math.round(rate * 100)
          };
        });

      trendData.sort((a, b) => normalize(a.month).localeCompare(normalize(b.month)));

      let supplierLatestMonth = '';
      if (trendData.length > 0) {
        supplierLatestMonth = trendData.reduce((max, d) => d.month > max ? d.month : max, '0000-00');
        const thresholdMonth = getThresholdMonth(supplierLatestMonth, 6);
        trendData = trendData.filter(d => d.month >= thresholdMonth);
      }

      // Benchmark Trend Data: average OTR of all suppliers assigned to the same buyer
      const buyerName = foundSupplier.buyer_name || '';
      let buyerSupplierCodes = new Set([normalize(supplierCode)]);
      if (buyerName) {
        const buyerSuppliers = supplierStatsRows.filter(
          s => normalize(s.client_code) === normalize(clientCode) &&
               normalize(s.buyer_name).toLowerCase() === normalize(buyerName).toLowerCase()
        );
        buyerSupplierCodes = new Set(buyerSuppliers.map(s => normalize(s.supplier_code)));
      }

      const monthlyBenchmarkAggregates = {};
      supplierMonthlyStatsRows.forEach(row => {
        const sCode = normalize(row.supplier_code);
        const cCode = normalize(row.client_code);
        if (cCode === normalize(clientCode) && buyerSupplierCodes.has(sCode)) {
          const month = formatMonth(row.month);
          if (!monthlyBenchmarkAggregates[month]) {
            monthlyBenchmarkAggregates[month] = { onTime: 0, total: 0 };
          }
          monthlyBenchmarkAggregates[month].onTime += parseInt(row.on_time_lines || 0, 10);
          monthlyBenchmarkAggregates[month].total += parseInt(row.total_po_lines || 0, 10);
        }
      });

      let benchmarkTrendData = Object.keys(monthlyBenchmarkAggregates).map(month => {
        const agg = monthlyBenchmarkAggregates[month];
        return {
          month,
          rate: agg.total > 0 ? Math.round((agg.onTime / agg.total) * 100) : 100
        };
      });

      if (benchmarkTrendData.length === 0) {
        benchmarkTrendData = [...trendData];
      }
      benchmarkTrendData.sort((a, b) => normalize(a.month).localeCompare(normalize(b.month)));
      if (supplierLatestMonth) {
        const thresholdMonth = getThresholdMonth(supplierLatestMonth, 6);
        benchmarkTrendData = benchmarkTrendData.filter(d => d.month >= thresholdMonth);
      }

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
      let recentDeliveries = communicationLogs
        .filter(log => normalize(log.client_code) === normalize(clientCode) && 
                       normalize(log.supplier_code) === normalize(supplierCode) && 
                       normalize(log['PO line item status']).toLowerCase() === 'closed')
        .map(log => {
          const variance = parseInt(log.delivery_variance_days || 0, 10);
          
          // Resolve delivery date: reply timestamp of the final stage that marked it closed
          let deliveryDate = log.delivered_date ||
                             log.stage3_reply_timestamp || 
                             log.stage2_5_reply_timestamp || 
                             log.stage2_reply_timestamp || 
                             log.stage1_5_reply_timestamp || 
                             log.stage1_reply_timestamp || 
                             '';

          const resolvedOutcome = log.outcome || (variance <= 0 ? 'On time' : 'Delayed');

          return {
            po: log.po_number || '--',
            materialName: log.material_name || '--',
            materialCode: log.material_code || '',
            needBy: log.deliver_by_date || '',
            delivered: deliveryDate,
            daysLate: variance,
            outcome: resolvedOutcome,
            commsGroupId: log.comms_group_id || ''
          };
        });

      const parseDate = (val) => {
        if (!val) return 0;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      recentDeliveries.sort((a, b) => parseDate(b.delivered) - parseDate(a.delivered));
      recentDeliveries = recentDeliveries.slice(0, 10);

      const responseData = {
        success: true,
        supplierMeta,
        kpis,
        trendData,
        benchmarkTrendData,
        delaySummary,
        recentDeliveries
      };

      cacheService.set(cacheKey, responseData, 60); // Cache for 60s
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
