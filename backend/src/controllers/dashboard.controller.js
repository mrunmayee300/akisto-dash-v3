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

const isOnTrack = (row) => {
  const followUpStage = normalize(row.follow_up_stage);
  const status = normalize(row.follow_up_status);
  
  const stage = followUpStage || 'Stage1';
  const prefix = stage.toLowerCase().replace('.', '_') + '_';
  const classification = normalize(row[prefix + 'delivery_status_classification']);
  const classificationLower = classification.toLowerCase();
  
  const needsHumanReview = normalize(row.needs_human_review).toLowerCase() === 'yes';
  const humanReviewStatus = normalize(row.human_review_status).toLowerCase() === 'pending';
  const isEscalated = status.toLowerCase() === 'escalation_sent';
  const isLowConfidence = normalize(row[prefix + 'supplier_reply_confidence']).toLowerCase() === 'low';

  if (needsHumanReview || humanReviewStatus || isEscalated || isLowConfidence) {
    return false;
  }

  // Passive listening stage 1.5/2.5 checks
  if (['Stage1.5', 'Stage2.5', 'stage1.5', 'stage2.5'].indexOf(stage) !== -1) {
    const hasReply = normalize(row[prefix + 'reply_timestamp']) !== '' || 
                     normalize(row[prefix + 'supplier_reply_status']).toLowerCase() === 'received';
    if (!hasReply) {
      return true; // Quiet monitoring - counts as On Track before reply
    }
    // After reply received: must be confirmed on-time
    const confirmedClassifications = ['on time', 'on time tbc', 'shipped tbc'];
    return confirmedClassifications.indexOf(classificationLower) !== -1;
  }

  // Active stages check: must be confirmed on-time
  const confirmedClassifications = ['on time', 'on time tbc', 'shipped tbc'];
  return confirmedClassifications.indexOf(classificationLower) !== -1;
};

const getPoStatusBucket = (row) => {
  const stage = row.follow_up_stage || 'Stage1';
  const prefix = stage.toLowerCase().replace('.', '_') + '_';
  const classification = normalize(row[prefix + 'delivery_status_classification']);
  const classificationLower = classification.toLowerCase();
  const status = normalize(row.follow_up_status);
  const statusLower = status.toLowerCase();

  const needsHumanReview = normalize(row.needs_human_review).toLowerCase() === 'yes';
  const humanReviewStatus = normalize(row.human_review_status).toLowerCase() === 'pending';
  const isEscalated = statusLower === 'escalation_sent';
  const isLowConfidence = normalize(row[prefix + 'supplier_reply_confidence']).toLowerCase() === 'low';
  
  // 1. Needs Attention Bucket
  const isNeedsAttention = needsHumanReview || humanReviewStatus || isEscalated || 
                           classificationLower.includes('delay') || 
                           classificationLower.includes('late') ||
                           isLowConfidence;

  if (isNeedsAttention) {
    let subStatus = 'Needs Review';
    if (classificationLower.includes('delay') || classificationLower.includes('late')) {
      subStatus = 'Delayed';
    } else if (isEscalated) {
      subStatus = 'No Response';
    }
    return { bucket: 'needsAttention', subStatus };
  }

  // 2. On Track Bucket
  const isOnTrackState = isOnTrack(row);
  if (isOnTrackState) {
    const isPassiveStage = ['Stage1.5', 'Stage2.5', 'stage1.5', 'stage2.5'].indexOf(stage) !== -1;
    return { bucket: 'onTrack', subStatus: isPassiveStage ? 'Monitoring' : 'Confirmed' };
  }

  // 3. Awaiting Reply Bucket
  let subStatus = 'Chasing Response';
  const activeChasing = ['outreach_sent', 'reminder1_sent', 'reminder2_sent', 'reminder3_sent'].indexOf(statusLower) !== -1;
  const isClarification = status === 'Clarification_Sent';
  const isColleagueDelegated = classification === 'awaiting_reply' && normalize(row.supplier_colleague_email) !== '';
  const isPromisedRevert = classification === 'awaiting_reply' && 
                           (normalize(row.promised_revert_date) !== '' || normalize(row[prefix + 'promised_revert_date']) !== '');
  
  if (isClarification) {
    subStatus = 'Clarification Sent';
  } else if (isColleagueDelegated) {
    subStatus = 'Delegated to Colleague';
  } else if (isPromisedRevert) {
    subStatus = 'Promised Check Date';
  }

  return { bucket: 'awaitingReply', subStatus };
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

        const { bucket, subStatus } = getPoStatusBucket(mergedRow);
        mergedRow.sub_status = subStatus;

        if (bucket === 'onTrack') {
          onTrack.push(mergedRow);
        } else if (bucket === 'needsAttention') {
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

      // Cache dashboard data for 5 seconds
      cacheService.set(cacheKey, output, 5);

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
        const { bucket } = getPoStatusBucket(mergedRow);

        if (bucket === 'onTrack') {
          onTrackCount++;
        } else if (bucket === 'needsAttention') {
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

      cacheService.set(cacheKey, summary, 5);
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
