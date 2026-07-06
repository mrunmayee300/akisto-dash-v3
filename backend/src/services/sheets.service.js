const { google } = require('googleapis');
const { getGoogleAuth, spreadsheetId } = require('../config/google');
const cacheService = require('./cache.service');

// Mock data for fallback mode
const mockClients = [
  { client_code: 'C0', client_company_name_full: 'Emerald Enterprises', client_company_name: 'Emerald', company_name: 'Emerald' },
  {
    client_code: 'C1',
    client_company_name_full: 'Akisto Corporation Ltd',
    client_company_name: 'Akisto Corp',
    client_industry: 'Manufacturing',
    client_hq_location: 'New York, USA',
    client_time_zone: 'EST',
    active: 'TRUE',
    test_mode: 'FALSE',
    calls_enabled: 'TRUE',
    email_send_mode_direct_or_draft: 'direct',
    ai_agent_buyer_name: 'Dan Whitaker',
    ai_agent_buyer_position: 'Senior Buyer',
    ai_agent_buyer_email: 'dan@company.com',
    buyer_name: 'Dan Whitaker',
    buyer_email: 'dan@company.com'
  },
  { client_code: 'C2', client_company_name_full: 'NTPC Sipat', client_company_name: 'Sipat', company_name: 'Sipat' }
];

const mockUsers = [
  { user_id: '1', 'User Name': 'Mrunmayee S', 'Role': 'Intern', email: 'mrunmayeesangode@gmail.com', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C0', role: 'Admin', active: 'TRUE' }, // password123
  { user_id: '2', 'User Name': 'Mrunmayee S', 'Role': 'Intern', email: 'mrunusangode@gmail.com', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C0', role: 'User', active: 'TRUE' }, // password123
  { user_id: '3', 'User Name': 'Mrunmayee Sangode', 'Role': 'Intern', email: 'bt23ece030@iiitn.ac.in', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C1', role: 'Admin', active: 'TRUE' }, // password123
  { user_id: '4', 'User Name': 'Dan Whitaker', 'Role': 'Buyer', email: 'dan@company.com', password_hash: '$2b$10$X8C9mUfVb6qSrnKzPqfB6uXp9vS1D.gB2P9vW6pSrnKzPqfB6uXp9vS1D.gB', client_code: 'C1', role: 'User', active: 'TRUE' } // password123
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
    po_line_key: 'C1_S17_1',
    client_code: 'C1',
    supplier_code: 'S17',
    po_number: '300519',
    material_code: 'CA-08',
    material_name: 'Citric acid',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-14',
    stage3_reply_timestamp: '2026-06-20',
    delivery_variance_days: '6',
    running_avg_response_time_days: '3.10',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S17-1'
  },
  {
    po_line_key: 'C1_S17_2',
    client_code: 'C1',
    supplier_code: 'S17',
    po_number: '300487',
    material_code: 'SC-11',
    material_name: 'Sodium citrate',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-02',
    stage3_reply_timestamp: '2026-06-02',
    delivery_variance_days: '0',
    running_avg_response_time_days: '1.10',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S17-2'
  },
  {
    po_line_key: 'C1_S17_3',
    client_code: 'C1',
    supplier_code: 'S17',
    po_number: '300455',
    material_code: 'CA-08',
    material_name: 'Citric acid',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-05-24',
    stage3_reply_timestamp: '2026-05-29',
    delivery_variance_days: '5',
    running_avg_response_time_days: '2.60',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S17-3'
  },
  {
    po_line_key: 'C1_S17_4',
    client_code: 'C1',
    supplier_code: 'S17',
    po_number: '300401',
    material_code: 'SC-11',
    material_name: 'Sodium citrate',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-05-15',
    stage3_reply_timestamp: '2026-05-15',
    delivery_variance_days: '0',
    running_avg_response_time_days: '0.80',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S17-4'
  },
  {
    po_line_key: 'C1_S17_5',
    client_code: 'C1',
    supplier_code: 'S17',
    po_number: '300388',
    material_code: 'CA-08',
    material_name: 'Citric acid',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-05-10',
    stage3_reply_timestamp: '2026-05-10',
    delivery_variance_days: '0',
    running_avg_response_time_days: '1.50',
    follow_up_status: 'Escalation_Sent',
    comms_group_id: 'CG-S17-5'
  },
  {
    po_line_key: 'C1_S20_1',
    client_code: 'C1',
    supplier_code: 'S20',
    po_number: '300901',
    material_code: 'BR-01',
    material_name: 'Industrial Brush',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-10',
    stage3_reply_timestamp: '2026-06-11',
    delivery_variance_days: '1',
    running_avg_response_time_days: '0.90',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S20-1'
  },
  {
    po_line_key: 'C1_S20_2',
    client_code: 'C1',
    supplier_code: 'S20',
    po_number: '300902',
    material_code: 'BR-02',
    material_name: 'Paint Brush',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-01',
    stage3_reply_timestamp: '2026-06-01',
    delivery_variance_days: '0',
    running_avg_response_time_days: '0.80',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S20-2'
  },
  {
    po_line_key: 'C1_S14_1',
    client_code: 'C1',
    supplier_code: 'S14',
    po_number: '300801',
    material_code: 'FL-09',
    material_name: 'Aluminum Foil',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-15',
    stage3_reply_timestamp: '2026-06-17',
    delivery_variance_days: '2',
    running_avg_response_time_days: '1.20',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S14-1'
  },
  {
    po_line_key: 'C1_S14_2',
    client_code: 'C1',
    supplier_code: 'S14',
    po_number: '300802',
    material_code: 'FL-10',
    material_name: 'Copper Foil',
    'PO line item status': 'Closed',
    deliver_by_date: '2026-06-05',
    stage3_reply_timestamp: '2026-06-05',
    delivery_variance_days: '0',
    running_avg_response_time_days: '1.00',
    follow_up_status: 'Replied',
    comms_group_id: 'CG-S14-2'
  }
];

const mockSuppliers = [
  {
    supplier_email_key: 'C1_S17_CA-08',
    client_code: 'C1',
    client_company_short_name: 'Akisto Corp',
    supplier_code: 'S17',
    supplier_name_full: 'Gulf Chemicals Pvt Ltd',
    supplier_name: 'Gulf Chem',
    material_code: 'CA-08',
    material_name: 'chemicals',
    primary_contact_names: 'Lokesh Reddy',
    primary_emails: 'lokesh@gulfchem.in',
    primary_phones: '+91-98765-43210',
    supplier_source_location: 'Mumbai, Maharashtra',
    delivery_location: 'Warehouse A',
    notes: 'None',
    ai_agent_buyer_name: 'Dan Whitaker',
    ai_agent_buyer_position: 'Senior Buyer',
    ai_agent_buyer_email: 'dan@company.com',
    client_buyer_name: 'Dan Whitaker',
    client_buyer_position: 'Senior Buyer',
    client_buyer_email: 'dan@company.com',
    working_days: 'Mon-Fri'
  },
  {
    supplier_email_key: 'C1_S14_FL-09',
    client_code: 'C1',
    client_company_short_name: 'Akisto Corp',
    supplier_code: 'S14',
    supplier_name_full: 'Summit Foils Inc',
    supplier_name: 'Summit Foils',
    material_code: 'FL-09',
    material_name: 'foils',
    primary_contact_names: 'Sarah Jenkins',
    primary_emails: 'sarah@summitfoils.com',
    primary_phones: '+1-555-0199',
    supplier_source_location: 'Chicago, Illinois',
    delivery_location: 'Warehouse B',
    notes: 'None',
    ai_agent_buyer_name: 'Dan Whitaker',
    ai_agent_buyer_position: 'Senior Buyer',
    ai_agent_buyer_email: 'dan@company.com',
    client_buyer_name: 'Dan Whitaker',
    client_buyer_position: 'Senior Buyer',
    client_buyer_email: 'dan@company.com',
    working_days: 'Mon-Fri'
  },
  {
    supplier_email_key: 'C1_S20_BR-01',
    client_code: 'C1',
    client_company_short_name: 'Akisto Corp',
    supplier_code: 'S20',
    supplier_name_full: 'Green Elements Ltd',
    supplier_name: 'Green Elements',
    material_code: 'BR-01',
    material_name: 'brushware',
    primary_contact_names: 'Marcus Vance',
    primary_emails: 'marcus@greenelements.co.uk',
    primary_phones: '+44-20-7946-0958',
    supplier_source_location: 'London, England',
    delivery_location: 'Warehouse C',
    notes: 'None',
    ai_agent_buyer_name: 'Dan Whitaker',
    ai_agent_buyer_position: 'Senior Buyer',
    ai_agent_buyer_email: 'dan@company.com',
    client_buyer_name: 'Dan Whitaker',
    client_buyer_position: 'Senior Buyer',
    client_buyer_email: 'dan@company.com',
    working_days: 'Mon-Fri'
  }
];

const mockSupplierStats = [
  { client_code: 'C1', supplier_code: 'S17', supplier_key: 'C1_S17', supplier_name: 'Gulf Chem', buyer_name: 'Dan Whitaker', buyer_position: 'Senior Buyer', category: 'chemicals', contact_name: 'Lokesh Reddy', email: 'lokesh@gulfchem.in', phone: '+91-98765-43210', source_location: 'Mumbai, Maharashtra', total_po_lines: '5', on_time_lines: '3', on_time_rate: '0.60', avg_days_late: '5.5', avg_response_time_days: '1.82', escalated_lines: '1', escalated_rate: '0.20', performance_flag: 'Review' },
  { client_code: 'C1', supplier_code: 'S20', supplier_key: 'C1_S20', supplier_name: 'Green Elements', buyer_name: 'Dan Whitaker', buyer_position: 'Senior Buyer', category: 'brushware', contact_name: 'Marcus Vance', email: 'marcus@greenelements.co.uk', phone: '+44-20-7946-0958', source_location: 'London, England', total_po_lines: '2', on_time_lines: '1', on_time_rate: '0.50', avg_days_late: '1.0', avg_response_time_days: '0.85', escalated_lines: '0', escalated_rate: '0.00', performance_flag: 'Watch' },
  { client_code: 'C1', supplier_code: 'S14', supplier_key: 'C1_S14', supplier_name: 'Summit Foils', buyer_name: 'Dan Whitaker', buyer_position: 'Senior Buyer', category: 'foils', contact_name: 'Sarah Jenkins', email: 'sarah@summitfoils.com', phone: '+1-555-0199', source_location: 'Chicago, Illinois', total_po_lines: '2', on_time_lines: '1', on_time_rate: '0.50', avg_days_late: '2.0', avg_response_time_days: '1.10', escalated_lines: '0', escalated_rate: '0.00', performance_flag: 'Watch' }
];

const mockSupplierMonthlyStats = [
  { client_code: 'C1', supplier_code: 'S17', month: '2026-01', total_po_lines: '30', on_time_lines: '24', on_time_rate: '0.80' },
  { client_code: 'C1', supplier_code: 'S17', month: '2026-02', total_po_lines: '28', on_time_lines: '21', on_time_rate: '0.75' },
  { client_code: 'C1', supplier_code: 'S17', month: '2026-03', total_po_lines: '32', on_time_lines: '22', on_time_rate: '0.69' },
  { client_code: 'C1', supplier_code: 'S17', month: '2026-04', total_po_lines: '29', on_time_lines: '17', on_time_rate: '0.59' },
  { client_code: 'C1', supplier_code: 'S17', month: '2026-05', total_po_lines: '31', on_time_lines: '16', on_time_rate: '0.52' },
  { client_code: 'C1', supplier_code: 'S17', month: '2026-06', total_po_lines: '27', on_time_lines: '12', on_time_rate: '0.44' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-01', total_po_lines: '15', on_time_lines: '14', on_time_rate: '0.93' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-02', total_po_lines: '16', on_time_lines: '15', on_time_rate: '0.94' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-03', total_po_lines: '18', on_time_lines: '17', on_time_rate: '0.94' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-04', total_po_lines: '15', on_time_lines: '14', on_time_rate: '0.93' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-05', total_po_lines: '17', on_time_lines: '15', on_time_rate: '0.88' },
  { client_code: 'C1', supplier_code: 'S20', month: '2026-06', total_po_lines: '15', on_time_lines: '14', on_time_rate: '0.93' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-01', total_po_lines: '20', on_time_lines: '18', on_time_rate: '0.90' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-02', total_po_lines: '22', on_time_lines: '19', on_time_rate: '0.86' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-03', total_po_lines: '21', on_time_lines: '18', on_time_rate: '0.86' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-04', total_po_lines: '23', on_time_lines: '20', on_time_rate: '0.87' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-05', total_po_lines: '22', on_time_lines: '19', on_time_rate: '0.86' },
  { client_code: 'C1', supplier_code: 'S14', month: '2026-06', total_po_lines: '20', on_time_lines: '18', on_time_rate: '0.90' }
];

const mockDelayEventLogs = [
  { event_id: 'DEL_01', po_line_key: 'C1_S17_1', client_code: 'C1', supplier_code: 'S17', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-06-15T10:00:00Z', delay_origin: 'supplier', delay_reason_category: 'Input material unavailable', delay_evidence: 'Raw citric acid shipment stuck', delay_confidence: 'high' },
  { event_id: 'DEL_02', po_line_key: 'C1_S17_3', client_code: 'C1', supplier_code: 'S17', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-05-25T14:30:00Z', delay_origin: 'supplier', delay_reason_category: 'Production capacity constraint', delay_evidence: 'Factory line maintenance shutdown', delay_confidence: 'high' },
  { event_id: 'DEL_03', po_line_key: 'C1_S17_5', client_code: 'C1', supplier_code: 'S17', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-05-11T09:15:00Z', delay_origin: 'internal', delay_reason_category: 'Payment pending', delay_evidence: 'Invoice awaiting accounts approval', delay_confidence: 'high' },
  { event_id: 'DEL_04', po_line_key: 'C1_S17_1', client_code: 'C1', supplier_code: 'S17', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-06-16T11:00:00Z', delay_origin: 'supplier', delay_reason_category: 'In-transit delay', delay_evidence: 'Port congestion at Mumbai', delay_confidence: 'high' },
  { event_id: 'DEL_05', po_line_key: 'C1_S20_1', client_code: 'C1', supplier_code: 'S20', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-06-10T12:00:00Z', delay_origin: 'supplier', delay_reason_category: 'Input material unavailable', delay_evidence: 'Shortage of brush bristles', delay_confidence: 'high' },
  { event_id: 'DEL_06', po_line_key: 'C1_S14_1', client_code: 'C1', supplier_code: 'S14', buyer_name: 'Dan Whitaker', buyer_email: 'dan@company.com', timestamp: '2026-06-16T08:00:00Z', delay_origin: 'supplier', delay_reason_category: 'In-transit delay', delay_evidence: 'Truck mechanical failure', delay_confidence: 'high' }
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

const getRawMockData = (sheetName) => {
  let mockData = [];
  if (sheetName === 'PO consolidated data') mockData = mockPOs;
  else if (sheetName === 'Communication Logs') mockData = mockCommLogs;
  else if (sheetName.startsWith('Material and Supplier Master')) mockData = mockSuppliers;
  else if (sheetName === 'Users') mockData = mockUsers;
  else if (sheetName.startsWith('Client info') || sheetName.startsWith('Client information')) mockData = mockClients;
  else if (sheetName === 'Supplier Stats') mockData = mockSupplierStats;
  else if (sheetName === 'Supplier Monthly Stats') mockData = mockSupplierMonthlyStats;
  else if (sheetName === 'Delay Event Logs') mockData = mockDelayEventLogs;

  if (mockData.length > 0) {
    const headers = Object.keys(mockData[0]);
    const rows = [headers];
    mockData.forEach(item => {
      rows.push(headers.map(h => item[h]));
    });
    return rows;
  }
  return [];
};

const sheetsService = {
  getMultipleSheets: async (sheetNames) => {
    const results = {};
    const missingSheets = [];

    // 1. Check cache first
    sheetNames.forEach(name => {
      const cacheKey = `raw_sheet:${name}`;
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        results[name] = cachedData;
      } else {
        missingSheets.push(name);
      }
    });

    if (missingSheets.length === 0) {
      return results;
    }

    const auth = getGoogleAuth();
    if (!auth || !spreadsheetId) {
      console.info(`Using mock data for sheets: ${missingSheets.join(', ')}`);
      missingSheets.forEach(name => {
        const rows = getRawMockData(name);
        const cacheKey = `raw_sheet:${name}`;
        cacheService.set(cacheKey, rows, 300); // Cache mock data for 300s
        results[name] = rows;
      });
      return results;
    }

    // 2. Try fetching spreadsheet metadata to resolve exact sheet names dynamically
    let availableSheets = null;
    const metaCacheKey = `spreadsheet_sheets_list:${spreadsheetId}`;
    availableSheets = cacheService.get(metaCacheKey);

    if (!availableSheets) {
      try {
        const sheets = google.sheets({ version: 'v4', auth });
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        availableSheets = meta.data.sheets.map(s => s.properties.title);
        cacheService.set(metaCacheKey, availableSheets, 3600); // Cache sheet titles list for 1 hour
      } catch (metaErr) {
        console.warn('Failed to fetch spreadsheet metadata, will use fallback mapping:', metaErr.message);
        
        // If metadata fetch fails due to permission issues (403), we handle it early
        const isAuthError = metaErr.status === 403 || metaErr.code === 403 || 
                            (metaErr.message && metaErr.message.toLowerCase().includes('permission')) ||
                            (metaErr.message && metaErr.message.toLowerCase().includes('api key'));
        if (isAuthError) {
          console.warn('Google Sheets API permission error on metadata fetch. Falling back to mock data.');
          missingSheets.forEach(name => {
            const rows = getRawMockData(name);
            const cacheKey = `raw_sheet:${name}`;
            cacheService.set(cacheKey, rows, 300);
            results[name] = rows;
          });
          return results;
        }
      }
    }

    const resolveSheetName = (name) => {
      if (availableSheets && Array.isArray(availableSheets)) {
        // Precise match
        if (availableSheets.includes(name)) return name;

        // Case-insensitive match
        const caseMatch = availableSheets.find(s => s.toLowerCase() === name.toLowerCase());
        if (caseMatch) return caseMatch;

        // Common variations
        if (name === 'Client info' || name === 'Client information') {
          const match = availableSheets.find(s => s === 'Client info' || s === 'Client information' || s.startsWith('Client info') || s.startsWith('Client information'));
          if (match) return match;
        }
        if (name === 'Material and Supplier Master Data' || name === 'Material and Supplier Master Da') {
          const match = availableSheets.find(s => s === 'Material and Supplier Master Data' || s === 'Material and Supplier Master Da' || s.startsWith('Material and Supplier Master'));
          if (match) return match;
        }
      }

      // Hardcoded fallback logic if metadata fetch failed or wasn't found
      if (name === 'Material and Supplier Master Data') {
        return 'Material and Supplier Master Da';
      }
      if (name === 'Client info') {
        return 'Client information';
      }
      return name;
    };

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      
      // Determine exact ranges based on dynamically resolved sheet names
      const ranges = missingSheets.map(name => {
        const resolvedName = resolveSheetName(name);
        
        let cols = 'A1:ZZ'; // default fallback range to capture all columns including GT/GU etc.
        return `${resolvedName}!${cols}`;
      });

      // Use batchGet to fetch all missing sheets in a single roundtrip
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
      });

      const valueRanges = response.data.valueRanges || [];
      missingSheets.forEach((name, index) => {
        const rows = valueRanges[index] ? (valueRanges[index].values || []) : [];
        const cacheKey = `raw_sheet:${name}`;
        cacheService.set(cacheKey, rows, 5); // Cache raw sheet data for 5s
        results[name] = rows;
      });

      return results;
    } catch (error) {
      console.error(`Error batch reading sheets from Google Sheets API:`, error);

      // Handle auth/permission error by falling back to mock data
      const isAuthError = error.status === 403 || error.code === 403 || 
                          (error.message && error.message.toLowerCase().includes('permission')) ||
                          (error.message && error.message.toLowerCase().includes('api key'));
      if (isAuthError) {
        console.warn('Google Sheets API permission error on batchGet. Falling back to mock data.');
        missingSheets.forEach(name => {
          const rows = getRawMockData(name);
          const cacheKey = `raw_sheet:${name}`;
          cacheService.set(cacheKey, rows, 300);
          results[name] = rows;
        });
        return results;
      }

      console.warn('Attempting sequential fallback read...');
      for (const name of missingSheets) {
        try {
          const resolvedName = resolveSheetName(name);
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${resolvedName}!A1:Z`,
          });
          const rows = res.data.values || [];
          const cacheKey = `raw_sheet:${name}`;
          cacheService.set(cacheKey, rows, 5);
          results[name] = rows;
        } catch (fallbackError) {
          console.error(`Fallback read failed for sheet ${name}:`, fallbackError);
          // If fallback fails due to auth/permission, try mock data as ultimate safety net
          const isFallbackAuthError = fallbackError.status === 403 || fallbackError.code === 403 ||
                                      (fallbackError.message && fallbackError.message.toLowerCase().includes('permission'));
          if (isFallbackAuthError) {
            const rows = getRawMockData(name);
            results[name] = rows;
          } else {
            results[name] = [];
          }
        }
      }
      return results;
    }
  },

  getMultipleSheetsObjects: async (sheetNames) => {
    const rawDataMap = await sheetsService.getMultipleSheets(sheetNames);
    const results = {};
    sheetNames.forEach(name => {
      results[name] = getObjects(rawDataMap[name] || []);
    });
    return results;
  },

  getRawData: async (sheetName) => {
    const dataMap = await sheetsService.getMultipleSheets([sheetName]);
    return dataMap[sheetName] || [];
  },

  getSheetObjects: async (sheetName) => {
    const rawDataMap = await sheetsService.getMultipleSheets([sheetName]);
    return getObjects(rawDataMap[sheetName] || []);
  }
};

module.exports = sheetsService;
