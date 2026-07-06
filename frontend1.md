# Integration Guide: Sheet Schemas & Dashboard Frontend Mapping

This document is a comprehensive, self-contained guide detailing the required Google Sheet schema changes, calculations logic, frontend data mappings, and mock datasets needed to build and preview the Akisto Buyer Dashboards.

---

## 1. Required Schema Changes in Sheets & Calculations

To enable the dashboard calculations, perform the following structural changes in your active Google Sheets workbook:

### 1.1 `Communication Logs` Schema Additions
Add these two columns to the far right of the sheet (preceding headers end at column `GS`, so these occupy columns `GT` and `GU`):
1. **`delivery_variance_days`** (Column `GT`): Tracks delivery variance (Days Late).
   * *Calculation*: When an order status is marked as closed, n8n subtracts the need-by date (`deliver_by_date`) from the final reply timestamp (confirming delivery) and writes the resulting integer here.
2. **`running_avg_response_time_days`** (Column `GU`): Tracks the running response speed of the supplier.
   * *Calculation*: When a reply is received, n8n runs a JavaScript block that finds all active outreach and reply timestamp pairs on this row, averages their durations, and writes the average value here.

---

### 1.2 New Sheet: `Delay Event Logs`
Create a brand new sheet named **`Delay Event Logs`** to log every classified delay event (supporting multiple delays on a single PO line).
* **Row 1 Headers**:
  * `event_id` (Unique composite key)
  * `po_line_key` (Foreign key linking to PO line)
  * `client_code` (Client identifier)
  * `supplier_code` (Supplier identifier)
  * `buyer_name` (Name of the managing buyer)
  * `buyer_email` (Email of the managing buyer)
  * `timestamp` (ISO datetime of classification)
  * `delay_origin` (Attributes responsibility: `supplier` or `internal`)
  * `delay_reason_category` (One of the 12 standard reasons)
  * `delay_evidence` (Email/call transcript quote explaining the delay)
  * `delay_confidence` (Classification confidence: `high` / `medium` / `low`)

---

### 1.3 `Supplier Stats` Summary Sheet Formulas
Ensure your `Supplier Stats` summary sheet calculations query the **`Communication Logs`** instead of `PO consolidated data`.
* **Headers (Row 1)**:
  `client_code` | `supplier_code` | `supplier_key` | `supplier_name` | `buyer_name` | `buyer_position` | `category` | `contact_name` | `email` | `phone` | `source_location` | `total_po_lines` | `on_time_lines` | `on_time_rate` | `avg_days_late` | `avg_response_time_days` | `escalated_lines` | `escalated_rate` | `performance_flag`
* **Row 2 Formulas (One-click copy-paste row for cell `C2`)**:
  Copy the line below and paste it directly into cell **`C2`**. Google Sheets will automatically distribute the formulas horizontally:
  ```text
  =A2&"_"&B2	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:F, 3, FALSE)	=VLOOKUP(A2, 'Client info'!A:M, 11, FALSE)	=VLOOKUP(A2, 'Client info'!A:M, 12, FALSE)	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:H, 5, FALSE)	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:I, 6, FALSE)	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:J, 7, FALSE)	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:K, 8, FALSE)	=VLOOKUP(B2, 'Material and Supplier Master Data'!D:Y, 22, FALSE)	=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2)	=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GT:GT, "<=0", 'Communication Logs'!K:K, "Closed")	=IF(L2>0, M2/L2, 1.0)	=IFERROR(AVERAGEIFS('Communication Logs'!GT:GT, 'Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GT:GT, ">0"), 0)	=IFERROR(AVERAGEIFS('Communication Logs'!GU:GU, 'Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GU:GU, ">0"), 0)	=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!M:M, "Escalation_Sent")	=IF(L2>0, Q2/L2, 0.0)	=IF(N2<0.6, "Watch", IF(N2<0.8, "Review", ""))
  ```
  *Drag these formulas down to cover all active rows below.*

---

## 2. Dashboard Frontend Mappings & Binding Guidelines

Use the values stored in these spreadsheet sheets to populate and render the dashboard elements on the frontend:

### 2.1 Mappings for the Supplier Reliability Table
* **Source**: `Supplier Stats` sheet (Filtered by logged-in buyer's name/email).
* **Mappings**:
  * **Supplier**: Renders `supplier_name`, with `supplier_code` and `category` as subtitle metadata.
  * **PO lines ordered**: Renders the `total_po_lines` value.
  * **On-time rate**: Renders `on_time_rate` as a percentage. Set the width of the progress bar fill using this percentage.
  * **Rate Theme**: Red progress bar if rate is $< 60\%$, Gold if $60\% - 79\%$, and Green if $\ge 80\%$.
  * **Avg days late**: Renders the `avg_days_late` value.
  * **Avg response time**: Renders the `avg_response_time_days` value.
  * **Escalated**: Renders the `escalated_rate` percentage value.
  * **Flag**: Renders a red `Watch` flag if value is "Watch", and a gold `Review` flag if value is "Review".

---

### 2.2 Mappings for the Recent Deliveries Table
* **Source**: `Communication Logs` sheet (Filtered by supplier and where status is `Closed`).
* **Mappings**:
  * **PO**: Renders the `po_number` value.
  * **Material**: Renders `material_name`, with `material_code` as subtitle.
  * **Need by**: Renders the agreed need-by date (formatted as Day-Month, e.g. 14 Jun).
  * **Delivered**: Renders the actual delivery date (taken from the reply timestamp of the final stage that marked it closed).
  * **Days late**: Renders `delivery_variance_days` (prefixed with "+" if positive).
  * **Outcome**: Renders a green `On time` pill if variance is $\le 0$, and a red `Delayed` pill if variance is $> 0$.

---

### 2.3 Math for SVG Trend Line Charts
* **Source**: `Supplier Monthly Stats` sheet.
* **Layout Math**:
  * **Main Performance Dashboard (Buyer Overview)**: 
    1. Identify all `supplier_code` values assigned to the logged-in buyer from the filtered `Supplier Stats` table.
    2. Retrieve all monthly trend rows for these suppliers in `Supplier Monthly Stats`.
    3. Sum the monthly `on_time_lines` and `total_po_lines` across these suppliers.
    4. Calculate the buyer's overall monthly OTR: `on_time_lines / total_po_lines`.
  * **Supplier Detail Dashboard**:
    * Render two lines: the selected supplier's OTR monthly values, and the buyer's overall average trend line calculated above (as a comparative benchmark).
  * **Coordinate Calculation**:
    * Spacing: Place 6 month labels (Jan to Jun) evenly along the horizontal X-axis.
    * Scaling: The vertical Y-axis spans from 40% (at the bottom) to 100% (at the top).
    * Coordinate: Convert the OTR percentage to Y-coordinate pixels by calculating:
      $$\text{Y Coordinate} = \text{bottom pixel border} - \left( \frac{\text{OTR} - 0.40}{1.00 - 0.40} \times \text{chart height span} \right)$$
    * Render the coordinates as the points array of the SVG `<polyline>` line and `<polygon>` gradient background.

---

### 2.4 Layout for Delay Analysis Charts
* **Source**: `Delay Event Logs` sheet.
* **Layout**:
  * **Main Performance Dashboard (Buyer Overview)**: 
    1. Fetch all logged delays for all supplier codes assigned to the active buyer from the `Delay Event Logs` sheet.
    2. Sum the occurrences of each of the 12 delay reason categories.
    3. Compute the percentages of each category relative to the buyer's total delays.
  * **Supplier Detail Dashboard**:
    * Filter the delay reason categories specifically for the selected supplier code.
  * **CSS Rendering**:
    * **Bar Width**: Bind the percentage column directly to the CSS progress bar width.
    * **Theme**: Map the `side` column to the bar color:
      * If `side` is "internal", render a Gold progress bar.
      * If `side` is "supplier", render an Emerald/Green progress bar.

---

## 3. Step-by-Step Instructions to Add Mock Data for Testing

To test and validate your dashboard rendering immediately, manually copy and paste the following mock datasets into their corresponding Google Sheets tabs.

### 3.1 Step A: Populate Buyer & Client Configs (`Client info`)
1. Open the **`Client info`** tab.
2. Paste this mock row in Row 2:

| client_code | client_company_name_full | client_company_name | client_industry | client_hq_location | client_time_zone | active | test_mode | calls_enabled | email_send_mode_direct_or_draft | ai_agent_buyer_name | ai_agent_buyer_position | ai_agent_buyer_email | buyer_name | buyer_email |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | Akisto Corporation Ltd | Akisto Corp | Manufacturing | New York, USA | EST | TRUE | FALSE | TRUE | direct | Dan Whitaker | Senior Buyer | dan@company.com | Dan Whitaker | dan@company.com |

---

### 3.2 Step B: Populate Master Data (`Material and Supplier Master Data`)
1. Open the **`Material and Supplier Master Data`** tab.
2. In Row 2 and below, paste these three supplier master rows:

| supplier_email_key | client_code | client_company_short_name | supplier_code | supplier_name_full | supplier_name | material_code | material_name | primary_contact_names | primary_emails | primary_phones | supplier_escalation_contact_name | supplier_escalation_contact_emails | supplier_escalation_phones | backup_contact_names | backup_contact_emails | agreed_lead_time_days | transit_time_days | preferred_contact_method | supplier_timezone | working_days | supplier_holidays | supplier_email_language | supplier_phone_language | supplier_source_location | delivery_location | PO_active (y/n)? | notes | ai_agent_buyer_name | ai_agent_buyer_position | ai_agent_buyer_email | ai_agent_buyer_phone | client_buyer_name | client_buyer_position | client_buyer_email |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| C1_S17_CA-08 | C1 | Akisto Corp | S17 | Gulf Chemicals Pvt Ltd | Gulf Chem | CA-08 | chemicals | Lokesh Reddy | lokesh@gulfchem.in | +91-98765-43210 | N/A | N/A | N/A | N/A | N/A | N/A | 14 | email | GMT+5.5 | Mon-Fri | None | EN | EN | Mumbai, Maharashtra | Warehouse A | y | None | Dan Whitaker | Senior Buyer | dan@company.com | +1-555-0100 | Dan Whitaker | Senior Buyer | dan@company.com |
| C1_S14_FL-09 | C1 | Akisto Corp | S14 | Summit Foils Inc | Summit Foils | FL-09 | foils | Sarah Jenkins | sarah@summitfoils.com | +1-555-0199 | N/A | N/A | N/A | N/A | N/A | N/A | 10 | email | GMT-6 | Mon-Fri | None | EN | EN | Chicago, Illinois | Warehouse B | y | None | Dan Whitaker | Senior Buyer | dan@company.com | +1-555-0100 | Dan Whitaker | Senior Buyer | dan@company.com |
| C1_S20_BR-01 | C1 | Akisto Corp | S20 | Green Elements Ltd | Green Elements | BR-01 | brushware | Marcus Vance | marcus@greenelements.co.uk | +44-20-7946-0958 | N/A | N/A | N/A | N/A | N/A | N/A | 7 | email | GMT | Mon-Fri | None | EN | EN | London, England | Warehouse C | y | None | Dan Whitaker | Senior Buyer | dan@company.com | +1-555-0100 | Dan Whitaker | Senior Buyer | dan@company.com |

---

### 3.3 Step C: Populate Completed PO Logs (`Communication Logs`)
1. Open the **`Communication Logs`** tab.
2. In Row 2 and below, paste the following mock transaction records to calculate OTR and Response Times:

| po_line_key | client_code | supplier_code | po_number | material_code | material_name | PO line item status | deliver_by_date | stage3_reply_timestamp | delivery_variance_days | running_avg_response_time_days | follow_up_status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| C1_S17_1 | C1 | S17 | 300519 | CA-08 | Citric acid | Closed | 2026-06-14 | 2026-06-20 | 6 | 3.10 | Replied |
| C1_S17_2 | C1 | S17 | 300487 | SC-11 | Sodium citrate | Closed | 2026-06-02 | 2026-06-02 | 0 | 1.10 | Replied |
| C1_S17_3 | C1 | S17 | 300455 | CA-08 | Citric acid | Closed | 2026-05-24 | 2026-05-29 | 5 | 2.60 | Replied |
| C1_S17_4 | C1 | S17 | 300401 | SC-11 | Sodium citrate | Closed | 2026-05-15 | 2026-05-15 | 0 | 0.80 | Replied |
| C1_S17_5 | C1 | S17 | 300388 | CA-08 | Citric acid | Closed | 2026-05-10 | 2026-05-10 | 0 | 1.50 | Escalation_Sent |
| C1_S20_1 | C1 | S20 | 300901 | BR-01 | Industrial Brush | Closed | 2026-06-10 | 2026-06-11 | 1 | 0.90 | Replied |
| C1_S20_2 | C1 | S20 | 300902 | BR-02 | Paint Brush | Closed | 2026-06-01 | 2026-06-01 | 0 | 0.80 | Replied |
| C1_S14_1 | C1 | S14 | 300801 | FL-09 | Aluminum Foil | Closed | 2026-06-15 | 2026-06-17 | 2 | 1.20 | Replied |
| C1_S14_2 | C1 | S14 | 300802 | FL-10 | Copper Foil | Closed | 2026-06-05 | 2026-06-05 | 0 | 1.00 | Replied |

---

### 3.4 Step D: Populate Monthly Trends (`Supplier Monthly Stats`)
1. Open the **`Supplier Monthly Stats`** tab.
2. In Row 2 and below, paste these monthly rate trend lines:

| client_code | supplier_code | month | total_po_lines | on_time_lines | on_time_rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | S17 | 2026-01 | 30 | 24 | 0.80 |
| C1 | S17 | 2026-02 | 28 | 21 | 0.75 |
| C1 | S17 | 2026-03 | 32 | 22 | 0.69 |
| C1 | S17 | 2026-04 | 29 | 17 | 0.59 |
| C1 | S17 | 2026-05 | 31 | 16 | 0.52 |
| C1 | S17 | 2026-06 | 27 | 12 | 0.44 |
| C1 | S20 | 2026-01 | 15 | 14 | 0.93 |
| C1 | S20 | 2026-02 | 16 | 15 | 0.94 |
| C1 | S20 | 2026-03 | 18 | 17 | 0.94 |
| C1 | S20 | 2026-04 | 15 | 14 | 0.93 |
| C1 | S20 | 2026-05 | 17 | 15 | 0.88 |
| C1 | S20 | 2026-06 | 15 | 14 | 0.93 |
| C1 | S14 | 2026-01 | 20 | 18 | 0.90 |
| C1 | S14 | 2026-02 | 22 | 19 | 0.86 |
| C1 | S14 | 2026-03 | 21 | 18 | 0.86 |
| C1 | S14 | 2026-04 | 23 | 20 | 0.87 |
| C1 | S14 | 2026-05 | 22 | 19 | 0.86 |
| C1 | S14 | 2026-06 | 20 | 18 | 0.90 |

---

### 3.5 Step E: Populate Transactional Delays (`Delay Event Logs`)
1. Open the **`Delay Event Logs`** tab.
2. In Row 2 and below, paste these individual delay classifications:

| event_id | po_line_key | client_code | supplier_code | buyer_name | buyer_email | timestamp | delay_origin | delay_reason_category | delay_evidence | delay_confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DEL_01 | C1_S17_1 | C1 | S17 | Dan Whitaker | dan@company.com | 2026-06-15T10:00:00Z | supplier | Input material unavailable | Raw citric acid shipment stuck | high |
| DEL_02 | C1_S17_3 | C1 | S17 | Dan Whitaker | dan@company.com | 2026-05-25T14:30:00Z | supplier | Production capacity constraint | Factory line maintenance shutdown | high |
| DEL_03 | C1_S17_5 | C1 | S17 | Dan Whitaker | dan@company.com | 2026-05-11T09:15:00Z | internal | Payment pending | Invoice awaiting accounts approval | high |
| DEL_04 | C1_S17_1 | C1 | S17 | Dan Whitaker | dan@company.com | 2026-06-16T11:00:00Z | supplier | In-transit delay | Port congestion at Mumbai | high |
| DEL_05 | C1_S20_1 | C1 | S20 | Dan Whitaker | dan@company.com | 2026-06-10T12:00:00Z | supplier | Input material unavailable | Shortage of brush bristles | high |
| DEL_06 | C1_S14_1 | C1 | S14 | Dan Whitaker | dan@company.com | 2026-06-16T08:00:00Z | supplier | In-transit delay | Truck mechanical failure | high |

---

## 4. Expected Summary Sheet Output Validation

Once the mock data is pasted, verify that the summary sheets automatically compute the following values:

### 4.1 Expected Row Output: `Supplier Stats` Tab
The UNIQUE spill formula and VLOOKUPs/COUNTIFS will populate these rows in the summary:

| client_code | supplier_code | supplier_key | supplier_name | buyer_name | category | total_po_lines | on_time_lines | on_time_rate | avg_days_late | avg_response_time_days | escalated_lines | escalated_rate | performance_flag |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | S17 | C1_S17 | Gulf Chem | Dan Whitaker | chemicals | 5 | 3 | 0.60 | 5.5 | 1.82 | 1 | 0.20 | Review |
| C1 | S20 | C1_S20 | Green Elements | Dan Whitaker | brushware | 2 | 1 | 0.50 | 1.0 | 0.85 | 0 | 0.00 | Watch |
| C1 | S14 | C1_S14 | Summit Foils | Dan Whitaker | foils | 2 | 1 | 0.50 | 2.0 | 1.10 | 0 | 0.00 | Watch |


