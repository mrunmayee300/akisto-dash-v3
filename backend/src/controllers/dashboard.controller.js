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
    if (classificationLower === 'unclear') {
      subStatus = 'Unclear Response';
    } else if (isLowConfidence) {
      subStatus = 'Low Confidence';
    } else if (classificationLower.includes('delay') || classificationLower.includes('late')) {
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
    subStatus = 'Clarification in progress';
  } else if (isColleagueDelegated) {
    subStatus = 'Delegated to Colleague';
  } else if (isPromisedRevert) {
    subStatus = 'Promised Check Date';
  }

  return { bucket: 'awaitingReply', subStatus };
};

const getLatestUpdateText = (comm) => {
  const stage = comm.follow_up_stage || 'Stage1';
  const prefix = stage.toLowerCase().replace('.', '_') + '_';

  // Check call 3, call 2, call 1 in this stage
  for (let i = 3; i >= 1; i--) {
    const timestamp = comm[`${prefix}reminder_call${i}_timestamp`];
    const answered = comm[`${prefix}reminder_call${i}_answered`];
    const outcome = comm[`${prefix}reminder_call${i}_call_outcome`];
    if (timestamp) {
      if (answered === 'No') {
        const label = i === 1 ? 'First' : i === 2 ? 'Second' : 'Third';
        const displayOutcome = outcome ? outcome.replace(/_/g, ' ') : 'no answer';
        return `${label} reminder call unanswered (${displayOutcome})`;
      }
    }
  }

  // Fallback to stage status text or supplier statement
  return comm[`${prefix}delivery_status_text`] ||
         comm[`${prefix}supplier_raw_statement`] ||
         'No status available';
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

const dashboardController = {
  getDashboardData: async (req, res) => {
    const clientCode = req.clientCode;
    const cacheKey = cacheService.generateKey('dashboard', clientCode);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
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

      // Map client_code to calls_enabled status
      const clientCallsEnabledMap = {};
      clientInfoRows.forEach(c => {
        if (c.client_code) {
          clientCallsEnabledMap[normalize(c.client_code)] = c.calls_enabled === 'TRUE' || c.calls_enabled === 'Yes' || c.calls_enabled === 'true';
        }
      });

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

        const poClientCode = mergedRow.client_code || clientCode;
        const callsEnabled = clientCallsEnabledMap[normalize(poClientCode)] === true;
        const bandConfig = getBandConfig(bandsRows, mergedRow.ship_by_band, mergedRow.follow_up_stage || 'Stage1');

        mergedRow.next_action = determineNextAction(mergedRow, bandConfig, callsEnabled);
        mergedRow.latest_update_text = getLatestUpdateText(mergedRow);

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

      // Cache dashboard data for 60 seconds
      cacheService.set(cacheKey, output, 60);

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
      const poData = await sheetsService.getSheetObjects('PO consolidated data', clientCode);
      const commData = await sheetsService.getSheetObjects('Communication Logs', clientCode);

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

      cacheService.set(cacheKey, summary, 60);
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
