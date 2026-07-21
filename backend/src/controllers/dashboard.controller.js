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
    let subStatus = 'Low Confidence';
    if (classificationLower.includes('unclear')) {
      subStatus = 'Unclear Response';
    } else if (classificationLower.includes('delay') || classificationLower.includes('late')) {
      subStatus = 'Delayed';
    } else if (isEscalated) {
      subStatus = 'No Response';
    } else if (isLowConfidence) {
      subStatus = 'Low Confidence';
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
    subStatus = 'Clarification in progress';
  } else if (isColleagueDelegated) {
    subStatus = 'Delegated to Colleague';
  } else if (isPromisedRevert) {
    subStatus = 'Promised Check Date';
  }

  return { bucket: 'awaitingReply', subStatus };
};

const getLatestSupplierReply = (comm) => {
  const replies = [];
  const stages = ['stage1', 'stage1_5', 'stage2', 'stage2_5', 'stage3'];

  stages.forEach(stage => {
    // 1. Email reply
    const replyTimestamp = comm[`${stage}_reply_timestamp`];
    if (replyTimestamp && String(replyTimestamp).trim() !== '') {
      const ts = new Date(replyTimestamp);
      if (!isNaN(ts.getTime())) {
        replies.push({
          timestamp: ts,
          rawTimestamp: replyTimestamp,
          text: comm[`${stage}_delivery_status_text`] || comm[`${stage}_supplier_raw_statement`] || 'Reply received'
        });
      }
    }

    // 2. Answered calls
    for (let i = 1; i <= 3; i++) {
      const callTimestamp = comm[`${stage}_reminder_call${i}_timestamp`];
      const answered = comm[`${stage}_reminder_call${i}_answered`];
      if (callTimestamp && String(callTimestamp).trim() !== '' && String(answered).trim().toLowerCase() === 'yes') {
        const ts = new Date(callTimestamp);
        if (!isNaN(ts.getTime())) {
          replies.push({
            timestamp: ts,
            rawTimestamp: callTimestamp,
            text: comm[`${stage}_reminder_call${i}_delivery_status_text`] || comm[`${stage}_reminder_call${i}_supplier_raw_statement`] || 'Responded on call'
          });
        }
      }
    }
  });

  if (replies.length === 0) {
    return null;
  }

  // Sort by timestamp descending
  replies.sort((a, b) => b.timestamp - a.timestamp);
  return replies[0];
};

const getBandConfig = (bandsRows, shipByBand, stage) => {
  const cleanBand = String(shipByBand || 'A').replace('Band', '').trim();
  const bandConfig = bandsRows.find(b => {
    return normalize(b.Band) === normalize(cleanBand);
  }) || {};

  const s = (stage === 'Stage1' || stage === 'Stage1.5') ? 'S1'
          : (stage === 'Stage2' || stage === 'Stage2.5') ? 'S2'
          : 'S3';

  return {
    outreach_email:  bandConfig[`${s} Outreach email (E#1)`] || 'No',
    reminder1_email: bandConfig[`${s} Reminder email (E#2)`] || 'No',
    reminder2_email: bandConfig[`${s} Reminder email (E#3)`] || 'No',
    reminder3_email: bandConfig[`${s} Reminder email (E#4)`] || 'No',
    call1:           bandConfig[`${s} Call (C#1)`] || 'No',
    call2:           bandConfig[`${s} Call (C#2)`] || 'No',
    call3:           bandConfig[`${s} Call (C#3)`] || 'No',
    escalate:        bandConfig[`${s} Escalate to buyer`] || 'Yes'
  };
};

const determineNextAction = (comm, bandConfig, callsEnabled) => {
  const stage = normalize(comm.follow_up_stage || 'Stage1');
  const prefix = stage.toLowerCase().replace('.', '_') + '_';

  const isSent = (val) => {
    return val !== undefined && val !== null && String(val).trim() !== '';
  };

  // Outreach check
  if (bandConfig.outreach_email === 'Yes' && !isSent(comm[`${prefix}outreach_sent`])) {
    return 'Send Outreach';
  }

  // Reminder 1 email check
  if (bandConfig.reminder1_email === 'Yes' && !isSent(comm[`${prefix}reminder_mail1_sent`])) {
    return 'Reminder Email 1';
  }

  // Reminder 2 email check
  if (bandConfig.reminder2_email === 'Yes' && !isSent(comm[`${prefix}reminder_mail2_sent`])) {
    return 'Reminder Email 2';
  }

  // Reminder 3 email check
  if (bandConfig.reminder3_email === 'Yes' && !isSent(comm[`${prefix}reminder_mail3_sent`])) {
    return 'Reminder Email 3';
  }

  if (callsEnabled) {
    // Call 1 check
    if (bandConfig.call1 === 'Yes' && !isSent(comm[`${prefix}reminder_call1_sent`])) {
      return 'Reminder Call 1';
    }

    // Call 2 check
    if (bandConfig.call2 === 'Yes' && !isSent(comm[`${prefix}reminder_call2_sent`])) {
      return 'Reminder Call 2';
    }

    // Call 3 check
    if (bandConfig.call3 === 'Yes' && !isSent(comm[`${prefix}reminder_call3_sent`])) {
      return 'Reminder Call 3';
    }
  }

  // Escalation check
  if (bandConfig.escalate === 'Yes' && !isSent(comm[`${prefix}internal_escalation_sent`])) {
    return 'Escalate To Buyer';
  }

  return 'Waiting';
};

const toDashboardPO = (row) => {
  const fields = [
    'client_code', 'po_line_key', 'comms_group_id', 'po_number', 'po_line_item',
    'supplier_code', 'supplier_name', 'material_code', 'material_name', 'quantity',
    'unit_of_measure', 'po_status', 'ship_by_band', 'issue_date',
    'ship_by_date_delivery_1', 'deliver_by_date_delivery_1', 'follow_up_stage',
    'follow_up_status', 'needs_human_review', 'human_review_status',
    'supplier_colleague_email', 'promised_revert_date', 'delivery_status_text', 'next_action',
    'latest_update_text', 'latest_update_timestamp', 'sub_status',
  ];

  ['stage1', 'stage1_5', 'stage2', 'stage2_5', 'stage3'].forEach(stage => {
    fields.push(
      `${stage}_delivery_status_classification`,
      `${stage}_delivery_status_text`,
      `${stage}_supplier_reply_confidence`,
      `${stage}_supplier_reply_status`,
      `${stage}_reply_timestamp`,
      `${stage}_promised_revert_date`,
    );
  });

  return fields.reduce((result, field) => {
    if (row[field] !== undefined) result[field] = row[field];
    return result;
  }, {});
};

const buildDashboardData = async (clientCode) => {
  const sheetsData = await sheetsService.getMultipleSheetsObjects([
    'PO consolidated data',
    'Communication Logs',
    'Bands Table',
    'Client info'
  ], clientCode);

  const poData = sheetsData['PO consolidated data'] || [];
  const commData = sheetsData['Communication Logs'] || [];
  const bandsRows = sheetsData['Bands Table'] || [];
  const clientInfoRows = sheetsData['Client info'] || [];

  const clientCallsEnabledMap = {};
  clientInfoRows.forEach(client => {
    if (client.client_code) {
      clientCallsEnabledMap[normalize(client.client_code)] = ['TRUE', 'Yes', 'true'].includes(client.calls_enabled);
    }
  });

  const filteredPOs = poData.filter(po => normalize(po.client_code) === normalize(clientCode));
  const commMap = {};
  commData.forEach(row => {
    if (row.po_line_key) commMap[row.po_line_key] = row;
  });

  const counts = { onTrack: 0, needsAttention: 0, awaitingReply: 0 };
  const openPOs = filteredPOs.map(po => {
    const mergedRow = { ...po, ...(commMap[po.po_line_key] || {}) };
    const callsEnabled = clientCallsEnabledMap[normalize(mergedRow.client_code || clientCode)] === true;
    const bandConfig = getBandConfig(bandsRows, mergedRow.ship_by_band, mergedRow.follow_up_stage || 'Stage1');

    mergedRow.next_action = determineNextAction(mergedRow, bandConfig, callsEnabled);
    const latestReply = getLatestSupplierReply(mergedRow);
    mergedRow.latest_update_text = latestReply ? latestReply.text : null;
    mergedRow.latest_update_timestamp = latestReply ? latestReply.rawTimestamp : null;

    const { bucket, subStatus } = getPoStatusBucket(mergedRow);
    mergedRow.sub_status = subStatus;
    counts[bucket] += 1;
    return toDashboardPO(mergedRow);
  });

  return {
    openPOs,
    summary: {
      total: openPOs.length,
      onTrack: counts.onTrack,
      needsAttention: counts.needsAttention,
      awaitingReply: counts.awaitingReply,
    },
    generatedAt: new Date().toISOString(),
  };
};

const dashboardController = {
  getDashboardData: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('dashboard', clientCode);

    try {
      const output = await cacheService.getOrSet(cacheKey, 60, () => buildDashboardData(clientCode));
      return res.json({ success: true, ...output });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      const status = error.status === 503 ? 503 : 500;
      return res.status(status).json({
        success: false,
        message: status === 503
          ? 'Dashboard data is temporarily unavailable.'
          : 'Failed to load dashboard data. Please try again.'
      });
    }
  },

  getSummary: async (req, res) => {
    const clientCode = req.clientCode;
    try {
      const dashboardKey = cacheService.generateKey('dashboard', clientCode);
      const dashboard = await cacheService.getOrSet(dashboardKey, 60, () => buildDashboardData(clientCode));
      return res.json({
        success: true,
        totalPOs: dashboard.summary.total,
        onTrackCount: dashboard.summary.onTrack,
        needsAttentionCount: dashboard.summary.needsAttention,
        awaitingReplyCount: dashboard.summary.awaitingReply,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error loading dashboard summary:', error);
      const status = error.status === 503 ? 503 : 500;
      return res.status(status).json({
        success: false,
        message: status === 503
          ? 'Dashboard data is temporarily unavailable.'
          : 'Failed to load dashboard summary.'
      });
    }
  }
};

module.exports = dashboardController;
