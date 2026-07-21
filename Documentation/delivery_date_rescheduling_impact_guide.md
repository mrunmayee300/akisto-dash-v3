# PO Delivery Date Rescheduling & Sheet Schema Updates: Impact Guide

This guide provides a detailed analysis of the changes in the updated database sheet (`sheetupd200726.xlsx`) compared to the previous sheet (`testing_sheet_for_danishCopy.xlsx`), focusing on the newly introduced **PO delivery date rescheduling logic** and its system-wide impacts.

---

## 1. Executive Summary & Critical Findings

During our detailed comparison of the old sheet (`testing_sheet_for_danishCopy.xlsx`) and the updated sheet (`sheetupd200726.xlsx`), we identified a critical data integration bug:
* **The Bug**: In the updated sheet, a block of 600 new PO line items for client **C1** (rows 373 to 972) were appended to the `PO consolidated data` sheet. However, the formulas in these rows were written using the old column layout (before the insertion of the `delivery_date_change_series` and `delivery_date_change_key` columns).
* **The Impact**: As a result of this misalignment, formulas in multiple key columns shifted to the left by 2–3 positions, rendering them corrupted. This causes:
  1. **Duplicate line keys** (e.g. `C1__S21` instead of `C1_300976_1`), which forces the dashboard to discard all but one line item per PO.
  2. **Missing supplier names** (evaluating to `"-"`).
  3. **Broken email outreach** due to `#N/A` or empty supplier emails.
  4. **Broken date calculations** causing `#VALUE!` errors in Excel/Sheets.
* **The Resolution**: We have successfully developed and executed a Python healing script (`heal_sheet.py`) directly on the local file `sheetupd200726.xlsx` to correct all 600 corrupted rows. The dashboard can now parse this sheet without any data loss.

---

## 2. Detailed Sheet Schema & Formula Analysis

### A. Column Shifting & Formula Shifts in `PO consolidated data`
Columns `delivery_date_change_series` (Col E) and `delivery_date_change_key` (Col F) were inserted in the middle of the sheet. For the new rows (373 onwards), the formulas were not adjusted to accommodate this shift, resulting in corrupted cells:

| Column | Header | Corrupted Formula (Shifted) | Correct Formula (Healed) | Impact if Left Unfixed |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `po_line_key` | `=B{row}&"_"&E{row}&"_"&H{row}` | `=B{row}&"_"&G{row}&"_"&J{row}` | Key resolves to `Client_Series_Supplier` (e.g., `C1__S21`). Multiple line items get identical keys, leading to duplicate key resolution discarding lines in the dashboard. |
| **E** | `delivery_date_change_series` | `None` (empty) | `0` (for original rows) | Empty cells cause code fallbacks or incorrect sorting of versions. |
| **F** | `delivery_date_change_key` | `None` (empty) | `=D{row}&"_"&E{row}` | Missing change key breaks unique indexing and matching in n8n and backend updates. |
| **I** | `supplier_name` | `=iferror(vlookup(F{row},...` | `=iferror(vlookup(H{row},...` | Tries to lookup Col F (`delivery_date_change_key`) which is empty, evaluating to `"-"`. |
| **W** | `ship_by_date_delivery_1` | `=S{row}-3` | `=V{row}-VLOOKUP(H{row},...` | Col S is `delivery_location` (text). Subtracting 3 from text causes a `#VALUE!` calculation error. |
| **X** | `number_of_ship_by_days` | `=T{row}-O{row}` | `=if(E{row}=0,W{row}-Q{row},W{row}-R{row})` | Col T is `po_status` and Col O is `po_value` (inactive), resulting in `#VALUE!` errors. |
| **BJ**| `primary_email` | `=vlookup(F{row},...` | `=vlookup(H{row},...` | Looks up Col F (`delivery_date_change_key`) instead of Col H (`supplier_code`), yielding `#N/A` emails. |
| **BK**| `Number of days since PO...` | `None` (empty) | `=TODAY()-Q{row}` | Stale or missing metrics on PO age. |
| **BL**| `% of time to ship by` | `None` (empty) | `=BK{row}/X{row}` | Missing variance metric percentages. |

> [!NOTE]
> The spreadsheet healer script has corrected these formulas dynamically across all 600 rows. When importing new batches of ERP PO data in the future, ensure the template formulas are updated to align with the columns above.

---

### B. User Access Restructure (`Users` Sheet)
The `Users` sheet has been upgraded to a 13-column schema:
`['user_id', 'client_code', 'user_name', 'access_role', 'email', 'active', 'job_role', 'notes', 'password_hash', 'password', 'User Name', 'Role', 'role']`

* **New Standardized Columns**:
  - `user_name` (Col C): Standardized lowercase field for usernames.
  - `access_role` (Col D): Permission level (`super_admin`, `admin`, `member`).
  - `job_role` (Col G): User title/designation.
  - `password` (Col J): Plaintext reference passwords used for staging or testing.
* **Legacy Columns**:
  - `User Name` (Col K), `Role` (Col L), and `role` (Col M) remain at the end of the sheet to ensure backwards compatibility with legacy authentication code.
* **Backend Resolution**:
  - The Express backend authentication logic in `auth.service.js` has already been confirmed as compatible, falling back to legacy properties when lowercase versions are missing:
    ```javascript
    const getUserName = (user) => normalize(user.user_name || user['User Name'] || user.userName);
    const getAccessRole = (user) => normalizeAccessRole(user.access_role || user.accessRole || user.role);
    ```

---

## 3. The Rescheduling Logic (Event Sourcing)

When a client or supplier edits the delivery date from the **PO Details Page**, the system does not overwrite the existing record. Instead, it appends a new transaction row (event sourcing) to track changes historically.

### A. How Rescheduling Is Written
1. A new row is appended to **`PO consolidated data`**:
   - `delivery_date_change_series` is incremented (e.g. `0` $\rightarrow$ `1` $\rightarrow$ `2`).
   - `delivery_date_change_key` is calculated as `comms_group_id_series` (e.g. `G249_1`).
   - `deliver_by_date_delivery_1` is set to the selected reschedule date.
   - `ship_by_date_delivery_1` is recalculated using the transit lead time from the master data.
   - `delivery_date_rescheduled_on` is stamped with the date of the change.
   - The status is set to `Open`.
2. A matching row is appended to **`Communication Logs`**:
   - Stores the same `delivery_date_change_series` and `delivery_date_change_key`.
   - `follow_up_stage` is reset to `"Stage1"`.
   - `follow_up_status` is reset to `"Stage_initiated"`.
   - All previous outreach stamps and communication logs are cleared for the new cycle.

### B. Impact on Express Backend & UI
Because historical rows and the newly active row both exist in the sheet, the database contains duplicate lines for the same `po_line_key`. 
* **Dashboard Lists**: Must deduplicate rows to only count the row with the highest `delivery_date_change_series` using the utility:
  ```javascript
  const selectLatestRowsByPoLineKey = (rows) => { ... }
  ```
* **PO Details Page**: The endpoint `GET /api/po/:commsGroupId` extracts details from both sheets. It uses `selectLatestRowsByPoLineKey` to filter out old rescheduling runs and identify the active dates, timelines, and next outreach status.

---

## 4. Remediation Code: Healing Script

If you need to re-heal or apply these formula corrections to a different sheet copy, you can run this Python script:

```python
import openpyxl

file_path = "sheetupd200726.xlsx"
wb = openpyxl.load_workbook(file_path, read_only=False, data_only=False)
sh = wb['PO consolidated data']

headers = [cell.value for cell in sh[1]]

# Get header index mappings
po_line_key_idx = headers.index('po_line_key')
client_code_idx = headers.index('client_code')
comms_group_id_idx = headers.index('comms_group_id')
delivery_date_change_series_idx = headers.index('delivery_date_change_series')
delivery_date_change_key_idx = headers.index('delivery_date_change_key')
supplier_name_idx = headers.index('supplier_name')
ship_by_date_delivery_1_idx = headers.index('ship_by_date_delivery_1')
number_of_ship_by_days_idx = headers.index('number_of_ship_by_days')
primary_email_idx = headers.index('primary_email')
days_since_issuance_idx = headers.index('Number of days since PO issuance')
pct_time_to_ship_idx = headers.index('% of time to ship by')

# Process rows 373 to end
for r in range(373, sh.max_row + 1):
    client_code = sh.cell(row=r, column=client_code_idx + 1).value
    if client_code is None or str(client_code).strip() == '':
        continue
        
    sh.cell(row=r, column=po_line_key_idx + 1, value=f'=B{r}&"_"&G{r}&"_"&J{r}')
    
    series_cell = sh.cell(row=r, column=delivery_date_change_series_idx + 1)
    if series_cell.value is None or str(series_cell.value).strip() == '':
        series_cell.value = 0
        
    sh.cell(row=r, column=delivery_date_change_key_idx + 1, value=f'=D{r}&"_"&E{r}')
    sh.cell(row=r, column=supplier_name_idx + 1, value=f"=iferror(vlookup(H{r},'Material and Supplier Master Da'!$D$1:$F$20000,3,False),\"-\")")
    sh.cell(row=r, column=ship_by_date_delivery_1_idx + 1, value=f"=V{r}-VLOOKUP(H{r},'Material and Supplier Master Da'!$D$1:$R$20000,15,False)")
    sh.cell(row=r, column=number_of_ship_by_days_idx + 1, value=f"=if(E{r}=0,W{r}-Q{r},W{r}-R{r})")
    sh.cell(row=r, column=primary_email_idx + 1, value=f"=vlookup(H{r},'Material and Supplier Master Da'!$D$1:$J$20000,7,False)")
    sh.cell(row=r, column=days_since_issuance_idx + 1, value=f"=TODAY()-Q{r}")
    sh.cell(row=r, column=pct_time_to_ship_idx + 1, value=f"=BK{r}/X{r}")

wb.save(file_path)
print("Formulas corrected successfully!")
```

---

## 5. Impact Checklist for n8n Workflows

When implementing rescheduling in the production environment, the following **n8n workflows** must be updated using the migration script `updated_workflows/migrate_delivery_date_versioning.js`:

1. **ERP Ingestion Workflow**: Ensure the JS script generating the initial rows writes `=B{row}&"_"&G{row}&"_"&J{row}` for `po_line_key` and does not use the legacy Column E references.
2. **Check Email Replies (All & Each)**: Workflows must filter POs using the maximum series key (`latestByLine` filter) so that email reminders and parsing only run against the active reschedule state.
3. **Stage Manager & Followup Actions**: When writing status changes back to the sheet, the update must match rows by BOTH `po_line_key` and `delivery_date_change_key` instead of `po_line_key` alone. Otherwise, old historical rows in the sheet will be overwritten.
