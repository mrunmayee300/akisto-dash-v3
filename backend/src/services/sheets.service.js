const { google } = require('googleapis');
const { getGoogleAuth, spreadsheetId } = require('../config/google');
const cacheService = require('./cache.service');

// Mock data for fallback mode
const mockClients = [
  { client_code: 'C0', client_company_name_full: 'Emerald Enterprises', client_company_name: 'Emerald', company_name: 'Emerald' },
  { client_code: 'C1', client_company_name_full: 'Biotique', client_company_name: 'Biotique', company_name: 'Biotique' },
  { client_code: 'C2', client_company_name_full: 'NTPC Sipat', client_company_name: 'Sipat', company_name: 'Sipat' }
];

const mockUsers = [
  { user_id: '1', email: 'mrunmayeesangode@gmail.com', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C0', role: 'Admin', active: 'TRUE' }, // password123
  { user_id: '2', email: 'mrunusangode@gmail.com', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C0', role: 'User', active: 'TRUE' }, // password123
  { user_id: '3', email: 'bt23ece030@iiitn.ac.in', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C1', role: 'Admin', active: 'TRUE' } // password123
];

const mockPOs = [
  {
    po_number: 'PO-4471',
    comms_group_id: 'CG-4471',
    supplier_name: 'Personal Brushes',
    supplier_code: 'S16',
    po_status: 'Open',
    ship_by_band: 'Band A',
    issue_date: '2026-06-10T10:00:00.000Z',
    po_line_key: 'C1_PO4471_1',
    po_line_item: '1',
    material_code: 'MAT-101',
    material_name: 'Soft Bristle Brush Head',
    quantity: '1000',
    unit_of_measure: 'pcs',
    ship_by_date_delivery_1: '2026-07-15T00:00:00.000Z',
    deliver_by_date_delivery_1: '2026-07-20T00:00:00.000Z',
    client_code: 'C1'
  },
  {
    po_number: 'PO-4472',
    comms_group_id: 'CG-4472',
    supplier_name: 'Eco Packaging Ltd',
    supplier_code: 'S22',
    po_status: 'Open',
    ship_by_band: 'Band B',
    issue_date: '2026-06-12T11:00:00.000Z',
    po_line_key: 'C1_PO4472_1',
    po_line_item: '1',
    material_code: 'MAT-202',
    material_name: 'Recycled Kraft Box',
    quantity: '5000',
    unit_of_measure: 'pcs',
    ship_by_date_delivery_1: '2026-07-18T00:00:00.000Z',
    deliver_by_date_delivery_1: '2026-07-25T00:00:00.000Z',
    client_code: 'C1'
  },
  {
    po_number: 'PO-8810',
    comms_group_id: 'CG-8810',
    supplier_name: 'Emerald Logistics',
    supplier_code: 'S09',
    po_status: 'Open',
    ship_by_band: 'Band A',
    issue_date: '2026-06-14T09:00:00.000Z',
    po_line_key: 'C0_PO8810_1',
    po_line_item: '1',
    material_code: 'MAT-909',
    material_name: 'Heavy Duty Pallet',
    quantity: '500',
    unit_of_measure: 'pcs',
    ship_by_date_delivery_1: '2026-07-10T00:00:00.000Z',
    deliver_by_date_delivery_1: '2026-07-14T00:00:00.000Z',
    client_code: 'C0'
  }
];

const mockCommLogs = [
  {
    po_line_key: 'C1_PO4471_1',
    comms_group_id: 'CG-4471',
    delivery_status_text: 'Supplier confirmed shipment is on track for July 15',
    follow_up_stage: 'stage1',
    follow_up_status: 'Completed',
    needs_human_review: 'No',
    stage1_outreach_timestamp: '2026-06-15T14:30:00.000Z',
    stage1_reply_timestamp: '2026-06-16T09:15:00.000Z',
    stage1_delivery_status_classification: 'On track',
    stage1_delivery_status_text: 'Confirmed on-time delivery',
    stage1_supplier_raw_statement: 'Yes, we are on track to ship the 1000 brushes by July 15 as requested.'
  },
  {
    po_line_key: 'C1_PO4472_1',
    comms_group_id: 'CG-4472',
    delivery_status_text: 'Supplier reported production delay of 5 days due to material shortage',
    follow_up_stage: 'stage1',
    follow_up_status: 'Escalated',
    needs_human_review: 'Yes',
    stage1_outreach_timestamp: '2026-06-16T10:00:00.000Z',
    stage1_reply_timestamp: '2026-06-17T11:45:00.000Z',
    stage1_delivery_status_classification: 'Delayed',
    stage1_delivery_status_text: 'Delayed by 5 days',
    stage1_supplier_raw_statement: 'We are experiencing a short delay in sourcing the recycled kraft paper. Production will be pushed back by 5 days, new ship date is July 23.'
  },
  {
    po_line_key: 'C0_PO8810_1',
    comms_group_id: 'CG-8810',
    delivery_status_text: 'No reply from supplier yet',
    follow_up_stage: 'stage1',
    follow_up_status: 'Awaiting Reply',
    needs_human_review: 'No',
    stage1_outreach_timestamp: '2026-06-20T08:00:00.000Z'
  }
];

const mockSuppliers = [
  {
    supplier_code: 'S16',
    supplier_name: 'Personal Brushes',
    primary_contact_names: 'John Doe',
    primary_emails: 'john@personalbrushes.com',
    primary_phones: '+1-555-0198',
    working_days: 'Mon-Fri',
    supplier_source_location: 'Boston, MA',
    delivery_location: 'Warehouse A',
    client_buyer_name: 'Sarah Jenkins',
    client_buyer_email: 'sarah@company.com'
  },
  {
    supplier_code: 'S22',
    supplier_name: 'Eco Packaging Ltd',
    primary_contact_names: 'Jane Smith',
    primary_emails: 'jane@ecopackaging.com',
    primary_phones: '+1-555-0143',
    working_days: 'Mon-Fri',
    supplier_source_location: 'Chicago, IL',
    delivery_location: 'Warehouse B',
    client_buyer_name: 'Sarah Jenkins',
    client_buyer_email: 'sarah@company.com'
  },
  {
    supplier_code: 'S09',
    supplier_name: 'Emerald Logistics',
    primary_contact_names: 'Robert Downey',
    primary_emails: 'robert@emeraldlogistics.com',
    primary_phones: '+1-555-0177',
    working_days: 'Mon-Sat',
    supplier_source_location: 'New York, NY',
    delivery_location: 'Emerald HQ',
    client_buyer_name: 'Michael Scott',
    client_buyer_email: 'michael@emerald.com'
  }
];

const getObjects = (rows) => {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map(h => String(h).trim());
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = rows[i][index] !== undefined ? rows[i][index] : '';
    });
    data.push(row);
  }
  return data;
};

const sheetsService = {
  getRawData: async (sheetName) => {
    const cacheKey = `raw_sheet:${sheetName}`;
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) return cachedData;

    const auth = getGoogleAuth();
    if (!auth || !spreadsheetId) {
      console.info(`Using mock data for sheet: ${sheetName}`);
      let mockData = [];
      if (sheetName === 'PO consolidated data') mockData = mockPOs;
      else if (sheetName === 'Communication Logs') mockData = mockCommLogs;
      else if (sheetName.startsWith('Material and Supplier Master')) mockData = mockSuppliers;
      else if (sheetName === 'Users') mockData = mockUsers;
      else if (sheetName.startsWith('Client info') || sheetName.startsWith('Client information')) mockData = mockClients;

      // Convert mock data objects back to rows format for consistency
      if (mockData.length > 0) {
        const headers = Object.keys(mockData[0]);
        const rows = [headers];
        mockData.forEach(item => {
          rows.push(headers.map(h => item[h]));
        });
        cacheService.set(cacheKey, rows, 30); // Cache mock data for 30s
        return rows;
      }
      return [];
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      
      // Try exact sheet name, if it fails, try common variations (e.g. truncated names)
      let response;
      try {
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:ZZ`,
        });
      } catch (err) {
        // If Google Sheets API is disabled or throws a 403, propagate it up
        if (err.status === 403 || (err.errors && err.errors[0] && err.errors[0].reason === 'accessNotConfigured')) {
          throw err;
        }

        console.warn(`Exact sheet name "${sheetName}" not found, attempting variations...`);
        let fallbackName = sheetName;
        if (sheetName === 'Material and Supplier Master Data') {
          fallbackName = 'Material and Supplier Master Da';
        } else if (sheetName === 'Client info') {
          fallbackName = 'Client information';
        }
        
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${fallbackName}!A1:ZZ`,
        });
      }

      const rows = response.data.values || [];
      cacheService.set(cacheKey, rows, 60); // Cache raw sheet data for 60s
      return rows;
    } catch (error) {
      console.error(`Error reading sheet "${sheetName}" from Google Sheets API:`, error);
      throw error;
    }
  },

  getSheetObjects: async (sheetName) => {
    const rows = await sheetsService.getRawData(sheetName);
    return getObjects(rows);
  }
};

module.exports = sheetsService;
