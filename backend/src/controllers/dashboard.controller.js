const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const latestClassification = (row) => {
  return (
    row.stage3_delivery_status_classification ||
    row.stage2_5_delivery_status_classification ||
    row.stage2_delivery_status_classification ||
    row.stage1_5_delivery_status_classification ||
    row.stage1_delivery_status_classification ||
    ''
  );
};

const dashboardController = {
  getDashboardData: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('dashboard', clientCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const poData = await sheetsService.getSheetObjects('PO consolidated data');
      const commData = await sheetsService.getSheetObjects('Communication Logs');

      // Filter POs by clientCode
      let filteredPOs = poData;
      if (clientCode) {
        filteredPOs = poData.filter(po => normalize(po.client_code) === normalize(clientCode));
      }

      // Map communication logs by po_line_key
      const commMap = {};
      commData.forEach(row => {
        if (row.po_line_key) {
          commMap[row.po_line_key] = row;
        }
      });

      const openPOs = [];
      const onTrack = [];
      const needsAttention = [];
      const awaitingReply = [];

      filteredPOs.forEach(po => {
        const comm = commMap[po.po_line_key] || {};

        // Merge PO and Communication Log data
        const mergedRow = { ...po, ...comm };

        openPOs.push(mergedRow);

        const classification = latestClassification(mergedRow).toLowerCase();

        if (
          classification === 'on time' ||
          classification.includes('tbc') ||
          classification.includes('soft') ||
          classification.includes('warning')
        ) {
          onTrack.push(mergedRow);
        } else if (
          classification.includes('delay') ||
          classification.includes('late') ||
          classification.includes('risk')
        ) {
          needsAttention.push(mergedRow);
        } else {
          awaitingReply.push(mergedRow);
        }
      });

      const output = {
        openPOs,
        onTrack,
        needsAttention,
        awaitingReply,
        generatedAt: new Date().toISOString()
      };

      // Cache dashboard data for 30 seconds
      cacheService.set(cacheKey, output, 30);

      return res.json(output);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load dashboard data. Please try again.'
      });
    }
  },

  getSummary: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('dashboard_summary', clientCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const poData = await sheetsService.getSheetObjects('PO consolidated data');
      const commData = await sheetsService.getSheetObjects('Communication Logs');

      let filteredPOs = poData;
      if (clientCode) {
        filteredPOs = poData.filter(po => normalize(po.client_code) === normalize(clientCode));
      }

      const commMap = {};
      commData.forEach(row => {
        if (row.po_line_key) commMap[row.po_line_key] = row;
      });

      let totalPOs = filteredPOs.length;
      let onTrackCount = 0;
      let needsAttentionCount = 0;
      let awaitingReplyCount = 0;

      filteredPOs.forEach(po => {
        const comm = commMap[po.po_line_key] || {};
        const mergedRow = { ...po, ...comm };
        const classification = latestClassification(mergedRow).toLowerCase();

        if (
          classification === 'on time' ||
          classification.includes('tbc') ||
          classification.includes('soft') ||
          classification.includes('warning')
        ) {
          onTrackCount++;
        } else if (
          classification.includes('delay') ||
          classification.includes('late') ||
          classification.includes('risk')
        ) {
          needsAttentionCount++;
        } else {
          awaitingReplyCount++;
        }
      });

      const summary = {
        totalPOs,
        onTrackCount,
        needsAttentionCount,
        awaitingReplyCount,
        generatedAt: new Date().toISOString()
      };

      cacheService.set(cacheKey, summary, 30);
      return res.json(summary);
    } catch (error) {
      console.error('Error loading dashboard summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load dashboard summary.'
      });
    }
  }
};

module.exports = dashboardController;
