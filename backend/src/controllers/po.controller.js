const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
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

const buildTimeline = (comm) => {
  const timeline = [];

  ['stage1', 'stage1_5', 'stage2', 'stage2_5', 'stage3'].forEach(stage => {
    if (comm[`${stage}_outreach_timestamp`]) {
      timeline.push({
        type: 'outreach',
        stage: stage,
        timestamp: comm[`${stage}_outreach_timestamp`]
      });
    }

    for (let i = 1; i <= 3; i++) {
      if (comm[`${stage}_reminder_mail${i}_timestamp`]) {
        timeline.push({
          type: `reminder${i}`,
          stage: stage,
          timestamp: comm[`${stage}_reminder_mail${i}_timestamp`]
        });
      }
    }

    for (let i = 1; i <= 3; i++) {
      if (comm[`${stage}_reminder_call${i}_timestamp`]) {
        timeline.push({
          type: `reminder_call${i}`,
          stage: stage,
          timestamp: comm[`${stage}_reminder_call${i}_timestamp`],
          answered: comm[`${stage}_reminder_call${i}_answered`],
          outcome: comm[`${stage}_reminder_call${i}_call_outcome`],
          classification: comm[`${stage}_reminder_call${i}_delivery_status_classification`],
          statusText: comm[`${stage}_reminder_call${i}_delivery_status_text`],
          statement: comm[`${stage}_reminder_call${i}_supplier_raw_statement`]
        });
      }
    }

    if (comm[`${stage}_reply_timestamp`] && comm[`${stage}_mode_of_reply_received`] !== 'call') {
      timeline.push({
        type: 'reply',
        stage: stage,
        timestamp: comm[`${stage}_reply_timestamp`]
      });
    }
  });

  return timeline;
};

const buildReplies = (comm) => {
  const replies = [];

  ['stage1', 'stage2', 'stage3'].forEach(stage => {
    const statement = comm[`${stage}_supplier_raw_statement`];

    if (statement) {
      replies.push({
        stage: stage,
        statement: statement,
        classification: comm[`${stage}_delivery_status_classification`],
        timestamp: comm[`${stage}_reply_timestamp`]
      });
    }
  });

  return replies;
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

const toClientCommunication = (comm) => {
  const fields = [
    'issue_date', 'delivery_status_text', 'delivery_location',
    'transit_time_days', 'promised_revert_date', 'supplier_colleague_name',
    'supplier_colleague_email', 'follow_up_stage', 'follow_up_status',
    'needs_human_review', 'human_review_status'
  ];

  ['stage1', 'stage1_5', 'stage2', 'stage2_5', 'stage3'].forEach(stage => {
    fields.push(
      `${stage}_outreach_timestamp`, `${stage}_reply_timestamp`,
      `${stage}_mode_of_reply_received`, `${stage}_delivery_status_classification`,
      `${stage}_delivery_status_text`, `${stage}_supplier_raw_statement`,
      `${stage}_supplier_reply_confidence`, `${stage}_supplier_reply_status`,
      `${stage}_promised_revert_date`, `${stage}_internal_escalation_sent`,
      `${stage}_internal_escalation_timestamp`
    );
    for (let i = 1; i <= 3; i++) {
      fields.push(
        `${stage}_reminder_mail${i}_timestamp`,
        `${stage}_reminder_call${i}_timestamp`,
        `${stage}_reminder_call${i}_answered`,
        `${stage}_reminder_call${i}_call_outcome`,
        `${stage}_reminder_call${i}_delivery_status_classification`,
        `${stage}_reminder_call${i}_delivery_status_text`,
        `${stage}_reminder_call${i}_supplier_raw_statement`
      );
    }
  });

  return fields.reduce((result, field) => {
    if (comm[field] !== undefined) result[field] = comm[field];
    return result;
  }, {});
};

const poController = {
  getPODetails: async (req, res) => {
    const commsGroupId = normalize(req.query.commsGroupId || req.params.commsGroupId);
    const clientCode = req.clientCode;

    if (!commsGroupId || commsGroupId.length > 200 || /[\u0000-\u001f]/.test(commsGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid commsGroupId is required'
      });
    }

    const cacheKey = cacheService.generateKey('po_details', clientCode, commsGroupId);
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const sheetsData = await sheetsService.getMultipleSheetsObjects([
        'PO consolidated data',
        'Material and Supplier Master Data',
        'Communication Logs',
        'Bands Table',
        'Client info'
      ], clientCode);
      const poRows = sheetsData['PO consolidated data'];
      const supplierRows = sheetsData['Material and Supplier Master Data'];
      const commRows = sheetsData['Communication Logs'];
      const bandsRows = sheetsData['Bands Table'] || [];
      const clientInfoRows = sheetsData['Client info'] || [];

      const poGroup = poRows.filter(row => {
        return normalize(row.comms_group_id) === normalize(commsGroupId) &&
               normalize(row.client_code) === normalize(clientCode);
      });

      if (poGroup.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'PO not found or unauthorized'
        });
      }

      const representative = poGroup[0];

      const foundSupplier = supplierRows.filter(s => {
        return normalize(s.supplier_code) === normalize(representative.supplier_code);
      });
      const supplier = foundSupplier.length > 0 ? foundSupplier[0] : {};

      const foundComm = commRows.filter(c => {
        return normalize(c.comms_group_id) === normalize(commsGroupId);
      });
      const comm = foundComm.length > 0 ? foundComm[0] : {};

      const poClientCode = representative.client_code || clientCode;
      const clientRow = clientInfoRows.find(c => normalize(c.client_code) === normalize(poClientCode)) || {};
      const callsEnabled = clientRow.calls_enabled === 'TRUE' || clientRow.calls_enabled === 'Yes' || clientRow.calls_enabled === 'true';

      const bandConfig = getBandConfig(bandsRows, representative.ship_by_band, comm.follow_up_stage || 'Stage1');

      const output = {
        success: true,
        deliveryStatusText: (() => {
          const latest = getLatestSupplierReply(comm);
          return latest ? latest.text : 'No status available';
        })(),

        header: {
          poNumber: representative.po_number,
          commsGroupId: representative.comms_group_id,
          supplier: representative.supplier_name,
          supplierCode: representative.supplier_code,
          status: representative.po_status || 'Open',
          shipByBand: representative.ship_by_band,
          followUpStage: comm.follow_up_stage,
          followUpStatus: comm.follow_up_status,
          lineItemCount: poGroup.length,
          issueDate: representative.issue_date
        },

        supplier: {
          supplierName: supplier.supplier_name,
          contactName: supplier.primary_contact_names,
          email: supplier.primary_emails,
          phone: supplier.primary_phones,
          workingDays: supplier.working_days,
          sourceLocation: supplier.supplier_source_location,
          deliveryLocation: supplier.delivery_location,
          buyerName: supplier.client_buyer_name,
          buyerEmail: supplier.client_buyer_email
        },

        lineItems: poGroup.map(row => {
          return {
            poLineKey: row.po_line_key,
            lineItem: row.po_line_item,
            materialCode: row.material_code,
            materialName: row.material_name,
            quantity: row.quantity,
            uom: row.unit_of_measure,
            shipBy: row.ship_by_date_delivery_1,
            deliverBy: row.deliver_by_date_delivery_1,
            carrier: row.carrier || '',
            trackingNumber: row.tracking_number || row.trackingNumber || ''
          };
        }),

        timeline: buildTimeline(comm),
        replies: buildReplies(comm),
        nextAction: determineNextAction(comm, bandConfig, callsEnabled),
        communication: toClientCommunication(comm)
      };

      // Cache PO details for 300 seconds
      cacheService.set(cacheKey, output, 300);

      return res.json(output);
    } catch (error) {
      console.error(`Error loading PO details for ${commsGroupId}:`, error);
      const status = error.status === 503 ? 503 : 500;
      return res.status(status).json({
        success: false,
        message: status === 503
          ? 'PO data is temporarily unavailable.'
          : 'Failed to load PO details. Please try again.'
      });
    }
  }
};

module.exports = poController;
