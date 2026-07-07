const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
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

const poController = {
  getPODetails: async (req, res) => {
    const commsGroupId = req.query.commsGroupId || req.params.commsGroupId;
    const clientCode = req.clientCode;

    if (!commsGroupId) {
      return res.status(400).json({
        success: false,
        message: 'commsGroupId is required'
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
               (!clientCode || normalize(row.client_code) === normalize(clientCode));
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
        deliveryStatusText: getLatestUpdateText(comm),

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
            deliverBy: row.deliver_by_date_delivery_1
          };
        }),

        timeline: buildTimeline(comm),
        replies: buildReplies(comm),
        nextAction: determineNextAction(comm, bandConfig, callsEnabled),
        communication: comm
      };

      // Cache PO details for 300 seconds
      cacheService.set(cacheKey, output, 300);

      return res.json(output);
    } catch (error) {
      console.error(`Error loading PO details for ${commsGroupId}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load PO details. Please try again.'
      });
    }
  }
};

module.exports = poController;
