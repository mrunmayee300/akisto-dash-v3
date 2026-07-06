# C0 (Emerald) Dummy Data for Communication Logs

This file contains dummy data for client code **C0 (Emerald)** to check the supplier stats.
It is formatted as **Tab-Separated Values (TSV)**, which means you can copy the lines inside the code block below and paste them directly into cell **A** of a new row in your **`Communication Logs`** sheet. Google Sheets will automatically distribute the values into the correct columns.

## Copy-Paste Data (TSV Format)

> [!IMPORTANT]
> Copy the 5 lines of raw text in the box below. In Google Sheets, select the first column (Column A) of an empty row at the bottom of the **`Communication Logs`** sheet, and paste (`Ctrl+V` or `Cmd+V`).

```text
C0_PO-001_1	C0	Emerald	CG_C0_S1_1	PO-001	S1	Bharat Polymers	1	M7	PP Homopolymer Granules	Closed	Stage3	Replied																																																																																																																																																													2026-06-10T09:00:00.000Z										2026-06-10T09:00:00.000Z																																		0	1.0
C0_PO-002_1	C0	Emerald	CG_C0_S1_2	PO-002	S1	Bharat Polymers	1	M7	PP Homopolymer Granules	Closed	Stage3	Replied																																																																																																																																																													2026-06-12T14:30:00.000Z										2026-06-12T14:30:00.000Z																																		4	2.5
C0_PO-003_1	C0	Emerald	CG_C0_S1_3	PO-003	S1	Bharat Polymers	1	M7	PP Homopolymer Granules	Closed	Stage3	Escalation_Sent																																																																																																																																																													2026-07-01T10:00:00.000Z										2026-07-01T10:00:00.000Z																																		-1	0.5
C0_PO-004_1	C0	Emerald	CG_C0_S2_1	PO-004	S2	Indus	1	M8	Stainless Steel Fasteners	Closed	Stage3	Replied																																																																																																																																																													2026-06-20T11:00:00.000Z										2026-06-20T11:00:00.000Z																																		0	1.5
C0_PO-005_1	C0	Emerald	CG_C0_S2_2	PO-005	S2	Indus	1	M8	Stainless Steel Fasteners	Closed	Stage3	Replied																																																																																																																																																													2026-07-02T16:00:00.000Z										2026-07-02T16:00:00.000Z																																		3	3.0
```

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
