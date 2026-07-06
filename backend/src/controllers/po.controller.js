const sheetsService = require('../services/sheets.service');
const cacheService = require('../services/cache.service');

const normalize = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const latestStatusText = (row) => {
  return (
    row.stage3_delivery_status_text ||
    row.stage2_5_delivery_status_text ||
    row.stage2_delivery_status_text ||
    row.stage1_5_delivery_status_text ||
    row.stage1_delivery_status_text ||
    ''
  );
};

const buildTimeline = (comm) => {
  const timeline = [];

  ['stage1', 'stage2', 'stage3'].forEach(stage => {
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

    if (comm[`${stage}_reply_timestamp`]) {
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

const determineNextAction = (comm) => {
  const stage = normalize(comm.follow_up_stage).toLowerCase().replace('.', '_');

  if (!stage) {
    return 'Send Outreach';
  }

  const prefix = `${stage}_`;

  if (!comm[`${prefix}outreach_sent`]) {
    return 'Send Outreach';
  }

  if (!comm[`${prefix}reminder_mail1_sent`]) {
    return 'Reminder Email 1';
  }

  if (!comm[`${prefix}reminder_mail2_sent`]) {
    return 'Reminder Email 2';
  }

  if (!comm[`${prefix}reminder_mail3_sent`]) {
    return 'Reminder Email 3';
  }

  if (!comm[`${prefix}reminder_call1_sent`]) {
    return 'Reminder Call 1';
  }

  if (!comm[`${prefix}internal_escalation_sent`]) {
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
        'Communication Logs'
      ], clientCode);
      const poRows = sheetsData['PO consolidated data'];
      const supplierRows = sheetsData['Material and Supplier Master Data'];
      const commRows = sheetsData['Communication Logs'];

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

      const output = {
        success: true,
        deliveryStatusText: latestStatusText(comm),

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
        nextAction: determineNextAction(comm),
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
