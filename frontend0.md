# Integration Guide: Sheet Schemas & Dashboard Frontend Mapping

This document lists the required database schema changes, explains the math and automation behind them, and provides step-by-step instructions on how to use these columns to render your frontend dashboards.

---

## 1. Required Schema Changes in Sheets & Calculations

To enable the dashboard statistics, perform these structural changes in your active Google Sheets workbook:

### 1.1 `Communication Logs` Additions
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
* **Row 2 Formulas**:
  * **`L2`** *(total PO lines)*: `=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2)`
  * **`M2`** *(on-time PO lines)*: `=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GT:GT, "<=0", 'Communication Logs'!K:K, "Closed")`
  * **`N2`** *(on-time rate)*: `=IF(L2>0, M2/L2, 1.0)`
  * **`O2`** *(avg days late)*: `=IFERROR(AVERAGEIFS('Communication Logs'!GT:GT, 'Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GT:GT, ">0"), 0)`
  * **`P2`** *(avg response time)*: `=IFERROR(AVERAGEIFS('Communication Logs'!GU:GU, 'Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!GU:GU, ">0"), 0)`
  * **`Q2`** *(escalated lines)*: `=COUNTIFS('Communication Logs'!B:B, A2, 'Communication Logs'!F:F, B2, 'Communication Logs'!M:M, "Escalation_Sent")`
  * **`R2`** *(escalation rate)*: `=IF(L2>0, Q2/L2, 0.0)`
  * **`S2`** *(performance flag)*: `=IF(N2<0.6, "Watch", IF(N2<0.8, "Review", ""))`

---

### 1.4 `Delay Summary` Chart Source Formulas
Ensure your `Delay Summary` sheet aggregates counts and percentages from the new transactional logs sheet:
* **Row 2 Formulas**:
  * **`delay_count` (GLOBAL)**: `=COUNTIFS('Delay Event Logs'!I:I, C2)`
  * **`delay_count` (Supplier-specific)**: `=COUNTIFS('Delay Event Logs'!D:D, B2, 'Delay Event Logs'!I:I, C2)`
  * **`percentage`**: `=E2 / SUMIFS(E:E, A:A, A2, B:B, B2)`

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
* **Source**: `Supplier Monthly Stats` sheet (Filtered by selected supplier code).
* **Layout Math**:
  * Spacing: Place 6 month labels (Jan to Jun) evenly along the horizontal X-axis.
  * Scaling: The vertical Y-axis spans from 40% (at the bottom) to 100% (at the top).
  * Coordinate: Convert the OTR percentage to Y-coordinate pixels by calculating:
    $$\text{Y Coordinate} = \text{bottom pixel border} - \left( \frac{\text{OTR} - 0.40}{1.00 - 0.40} \times \text{chart height span} \right)$$
  * Render the resulting coordinates as the points array of the SVG `<polyline>` line and `<polygon>` gradient background.

---

### 2.4 Layout for Delay Analysis Charts
* **Source**: `Delay Summary` sheet (Filtered by selected supplier code).
* **Layout**:
  * **Bar Width**: Bind the percentage column directly to the CSS progress bar width.
  * **Theme**: Map the `side` column to the bar color:
    * If `side` is "internal", render a Gold progress bar.
    * If `side` is "supplier", render an Emerald/Green progress bar.

---

## 3. Step-by-Step Instructions to Add Mock Data for Testing

To test and validate your dashboard rendering immediately, manually copy and paste the following mock datasets into their corresponding Google Sheets tabs.

### 3.1 Step A: Populate Monthly Trends (`Supplier Monthly Stats`)
1. Open the **`Supplier Monthly Stats`** tab.
2. In row 2 and below, paste the following 12 rows of trend data (representing the declining rates for Gulf Chem `S17` and the stable benchmark for `GLOBAL`):

| client_code | supplier_code | month | total_po_lines | on_time_lines | on_time_rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | S17 | 2026-01 | 30 | 24 | 0.80 |
| C1 | S17 | 2026-02 | 28 | 21 | 0.75 |
| C1 | S17 | 2026-03 | 32 | 22 | 0.69 |
| C1 | S17 | 2026-04 | 29 | 17 | 0.59 |
| C1 | S17 | 2026-05 | 31 | 16 | 0.52 |
| C1 | S17 | 2026-06 | 27 | 12 | 0.44 |
| C1 | GLOBAL | 2026-01 | 1500 | 1050 | 0.70 |
| C1 | GLOBAL | 2026-02 | 1600 | 1152 | 0.72 |
| C1 | GLOBAL | 2026-03 | 1550 | 1131 | 0.73 |
| C1 | GLOBAL | 2026-04 | 1700 | 1292 | 0.76 |
| C1 | GLOBAL | 2026-05 | 1650 | 1270 | 0.77 |
| C1 | GLOBAL | 2026-06 | 1840 | 1435 | 0.78 |

---

### 3.2 Step B: Populate Delay Summary Mock Data (`Delay Summary`)
1. Open the **`Delay Summary`** tab.
2. Paste the following rows of category data (representing Gulf Chem's supplier-side shortages vs. buyer-side payment delays):

| client_code | supplier_code | delay_reason_category | side | delay_count | percentage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | GLOBAL | Input material unavailable | supplier | 24 | 0.24 |
| C1 | GLOBAL | Payment pending | internal | 19 | 0.19 |
| C1 | GLOBAL | Production capacity constraint | supplier | 18 | 0.18 |
| C1 | GLOBAL | Price agreement pending | supplier | 12 | 0.12 |
| C1 | GLOBAL | Awaiting revised PO | internal | 12 | 0.12 |
| C1 | GLOBAL | In-transit delay | supplier | 7 | 0.07 |
| C1 | S17 | Input material unavailable | supplier | 17 | 0.41 |
| C1 | S17 | Production capacity constraint | supplier | 12 | 0.29 |
| C1 | S17 | Payment pending | internal | 7 | 0.18 |
| C1 | S17 | In-transit delay | supplier | 5 | 0.12 |

---

### 3.3 Step C: Populate Recent Deliveries (`Communication Logs`)
1. Open the **`Communication Logs`** tab.
2. Insert 5 mock rows representing completed orders for **Gulf Chem (`S17`)**. Map the key columns to the values below:

* **Row 1**:
  * `po_number` = `300519`
  * `material_name` = `Citric acid`
  * `material_code` = `CA-08`
  * `deliver_by_date` = `2026-06-14`
  * `stage3_reply_timestamp` (delivered date) = `2026-06-20`
  * `delivery_variance_days` = `6`
  * `PO line item status` = `Closed`
* **Row 2**:
  * `po_number` = `300487`
  * `material_name` = `Sodium citrate`
  * `material_code` = `SC-11`
  * `deliver_by_date` = `2026-06-02`
  * `stage3_reply_timestamp` (delivered date) = `2026-06-02`
  * `delivery_variance_days` = `0`
  * `PO line item status` = `Closed`
* **Row 3**:
  * `po_number` = `300455`
  * `material_name` = `Citric acid`
  * `material_code` = `CA-08`
  * `deliver_by_date` = `2026-05-24`
  * `stage3_reply_timestamp` (delivered date) = `2026-05-29`
  * `delivery_variance_days` = `5`
  * `PO line item status` = `Closed`
* **Row 4**:
  * `po_number` = `300401`
  * `material_name` = `Sodium citrate`
  * `material_code` = `SC-11`
  * `deliver_by_date` = `2026-05-15`
  * `stage3_reply_timestamp` (delivered date) = `2026-05-15`
  * `delivery_variance_days` = `0`
  * `PO line item status` = `Closed`
* **Row 5**:
  * `po_number` = `300388`
  * `material_name` = `Citric acid`
  * `material_code` = `CA-08`
  * `deliver_by_date` = `2026-05-10`
  * `stage3_reply_timestamp` (delivered date) = `2026-05-10`
  * `delivery_variance_days` = `0`
  * `PO line item status` = `Closed`

