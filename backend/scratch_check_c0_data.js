const fs = require('fs');
const path = require('path');

const rows = [
  // Row A
  {
    1: 'C0_PO-001_1', // po_line_key (A)
    2: 'C0',           // client_code (B)
    3: 'Emerald',      // client_company_name (C)
    4: 'CG_C0_S1_1',   // comms_group_id (D)
    5: 'PO-001',       // po_number (E)
    6: 'S1',           // supplier_code (F)
    7: 'Bharat Polymers', // supplier_name (G)
    8: '1',            // po_line_item (H)
    9: 'M7',           // material_code (I)
    10: 'PP Homopolymer Granules', // material_name (J)
    11: 'Closed',      // PO line item status (K)
    12: 'Stage3',      // follow_up_stage (L)
    13: 'Replied',     // follow_up_status (M)
    170: '2026-06-10T09:00:00.000Z', // stage3_reply_timestamp (FN)
    180: '2026-06-10T09:00:00.000Z', // last_action_timestamp (FX)
    214: '0',          // delivery_variance_days (HF)
    215: '1.0'         // running_avg_response_time_days (HG)
  },
  // Row B
  {
    1: 'C0_PO-002_1',
    2: 'C0',
    3: 'Emerald',
    4: 'CG_C0_S1_2',
    5: 'PO-002',
    6: 'S1',
    7: 'Bharat Polymers',
    8: '1',
    9: 'M7',
    10: 'PP Homopolymer Granules',
    11: 'Closed',
    12: 'Stage3',
    13: 'Replied',
    170: '2026-06-12T14:30:00.000Z',
    180: '2026-06-12T14:30:00.000Z',
    214: '4',
    215: '2.5'
  },
  // Row C
  {
    1: 'C0_PO-003_1',
    2: 'C0',
    3: 'Emerald',
    4: 'CG_C0_S1_3',
    5: 'PO-003',
    6: 'S1',
    7: 'Bharat Polymers',
    8: '1',
    9: 'M7',
    10: 'PP Homopolymer Granules',
    11: 'Closed',
    12: 'Stage3',
    13: 'Escalation_Sent',
    170: '2026-07-01T10:00:00.000Z',
    180: '2026-07-01T10:00:00.000Z',
    214: '-1',
    215: '0.5'
  },
  // Row D
  {
    1: 'C0_PO-004_1',
    2: 'C0',
    3: 'Emerald',
    4: 'CG_C0_S2_1',
    5: 'PO-004',
    6: 'S2',
    7: 'Indus',
    8: '1',
    9: 'M8',
    10: 'Stainless Steel Fasteners',
    11: 'Closed',
    12: 'Stage3',
    13: 'Replied',
    170: '2026-06-20T11:00:00.000Z',
    180: '2026-06-20T11:00:00.000Z',
    214: '0',
    215: '1.5'
  },
  // Row E
  {
    1: 'C0_PO-005_1',
    2: 'C0',
    3: 'Emerald',
    4: 'CG_C0_S2_2',
    5: 'PO-005',
    6: 'S2',
    7: 'Indus',
    8: '1',
    9: 'M8',
    10: 'Stainless Steel Fasteners',
    11: 'Closed',
    12: 'Stage3',
    13: 'Replied',
    170: '2026-07-02T16:00:00.000Z',
    180: '2026-07-02T16:00:00.000Z',
    214: '3',
    215: '3.0'
  }
];

function buildTSVLine(rowData) {
  const elements = [];
  for (let col = 1; col <= 215; col++) {
    elements.push(rowData[col] || '');
  }
  return elements.join('\t');
}

const tsvLines = rows.map(r => buildTSVLine(r)).join('\n');

const mdContent = `# C0 (Emerald) Dummy Data for Communication Logs

This file contains dummy data for client code **C0 (Emerald)** to check the supplier stats.
It is formatted as **Tab-Separated Values (TSV)**, which means you can copy the lines inside the code block below and paste them directly into cell **A** of a new row in your **\`Communication Logs\`** sheet. Google Sheets will automatically distribute the values into the correct columns.

## Copy-Paste Data (TSV Format)

> [!IMPORTANT]
> Copy the 5 lines of raw text in the box below. In Google Sheets, select the first column (Column A) of an empty row at the bottom of the **\`Communication Logs\`** sheet, and paste (\`Ctrl+V\` or \`Cmd+V\`).

\`\`\`text
${tsvLines}
\`\`\`

## Human-Readable Layout of columns with data

Below is a reference table showing only the columns that have values. All other columns (from N to FM, FO to FW, and FY to HE) should remain empty.

| Column | Column Letter | Header Name | Row 1 (S1) | Row 2 (S1) | Row 3 (S1) | Row 4 (S2) | Row 5 (S2) |
|---|---|---|---|---|---|---|---|
| **1** | A | po_line_key | C0_PO-001_1 | C0_PO-002_1 | C0_PO-003_1 | C0_PO-004_1 | C0_PO-005_1 |
| **2** | B | client_code | C0 | C0 | C0 | C0 | C0 |
| **3** | C | client_company_name | Emerald | Emerald | Emerald | Emerald | Emerald |
| **4** | D | comms_group_id | CG_C0_S1_1 | CG_C0_S1_2 | CG_C0_S1_3 | CG_C0_S2_1 | CG_C0_S2_2 |
| **5** | E | po_number | PO-001 | PO-002 | PO-003 | PO-004 | PO-005 |
| **6** | F | supplier_code | S1 | S1 | S1 | S2 | S2 |
| **7** | G | supplier_name | Bharat Polymers | Bharat Polymers | Bharat Polymers | Indus | Indus |
| **8** | H | po_line_item | 1 | 1 | 1 | 1 | 1 |
| **9** | I | material_code | M7 | M7 | M7 | M8 | M8 |
| **10** | J | material_name | PP Homopolymer Granules | PP Homopolymer Granules | PP Homopolymer Granules | Stainless Steel Fasteners | Stainless Steel Fasteners |
| **11** | K | PO line item status | Closed | Closed | Closed | Closed | Closed |
| **12** | L | follow_up_stage | Stage3 | Stage3 | Stage3 | Stage3 | Stage3 |
| **13** | M | follow_up_status | Replied | Replied | Escalation_Sent | Replied | Replied |
| **170** | FN | stage3_reply_timestamp | 2026-06-10T09:00:00.000Z | 2026-06-12T14:30:00.000Z | 2026-07-01T10:00:00.000Z | 2026-06-20T11:00:00.000Z | 2026-07-02T16:00:00.000Z |
| **180** | FX | last_action_timestamp | 2026-06-10T09:00:00.000Z | 2026-06-12T14:30:00.000Z | 2026-07-01T10:00:00.000Z | 2026-06-20T11:00:00.000Z | 2026-07-02T16:00:00.000Z |
| **214** | HF | delivery_variance_days | 0 | 4 | -1 | 0 | 3 |
| **215** | HG | running_avg_response_time_days | 1.0 | 2.5 | 0.5 | 1.5 | 3.0 |
`;

const outputPath = path.join(__dirname, '..', 'dummy_data_c0.md');
fs.writeFileSync(outputPath, mdContent, 'utf-8');
console.log("Successfully generated dummy_data_c0.md at:", outputPath);
