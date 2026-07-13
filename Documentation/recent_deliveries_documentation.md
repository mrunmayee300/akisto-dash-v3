# Recent Deliveries Table Documentation

This document explains the data source, backend resolution rules, and frontend rendering logic for the **Recent Deliveries Table** displayed on the individual **Supplier Detail** page.

---

## 1. Mapped Google Sheet & Columns

The table retrieves data from a single database log sheet:

### Sheet: `Communication Logs`
Contains transaction history logs for every PO line item.

| Column Name | JSON Property | Description |
| :--- | :--- | :--- |
| `client_code` | `log.client_code` | Filters logs matching the active client. |
| `supplier_code` | `log.supplier_code` | Filters logs matching the target supplier. |
| `PO line item status` | — | Must be exactly `"Closed"` (indicating a completed delivery). |
| `po_number` | `po` | The purchase order number. |
| `material_name` | `materialName` | Description of the material. |
| `material_code` | `materialCode` | Part or item SKU. |
| `deliver_by_date` | `needBy` | Original requested delivery date (Need by). |
| `delivery_variance_days` | `daysLate` | Calculated shipment delay in days (variance relative to target). |
| `delivered_date` | `delivered` | Explicit log showing when order was received. |
| `stage3_reply_timestamp` | `delivered` | First stage fallback if explicit `delivered_date` is blank. |
| `stage2_5_reply_timestamp` | `delivered` | Second fallback for delivery timestamp. |
| `stage2_reply_timestamp` | `delivered` | Third fallback for delivery timestamp. |
| `stage1_5_reply_timestamp` | `delivered` | Fourth fallback for delivery timestamp. |
| `stage1_reply_timestamp` | `delivered` | Fifth fallback for delivery timestamp. |
| `outcome` | `outcome` | Log showing delivery outcome classification. |
| `comms_group_id` | `commsGroupId` | Unique grouping code used for detail page routing. |

---

## 2. Backend Filtering & Resolution Logic

When retrieving supplier details (`action=supplierDetail`), the backend processes the log data:

### A. Raw Row Filtering
Filters rows from the `Communication Logs` sheet that meet the following conditions:
- `client_code` matches the client session.
- `supplier_code` matches the queried supplier code.
- `PO line item status` is exactly `'closed'` (case-insensitive, trimmed).
- The resolved delivery date's month falls within the trailing 6-month window (inclusive of the current month resolved in the `America/New_York` timezone at query run-time).

### B. Delivery Date Resolution
The actual delivery timestamp (`delivered`) is resolved by taking the first non-empty date value in sequence:
1. `delivered_date`
2. `stage3_reply_timestamp` (Dispatch stage)
3. `stage2_5_reply_timestamp` (Order progress update)
4. `stage2_reply_timestamp` (Order progress stage)
5. `stage1_5_reply_timestamp` (PO confirmation update)
6. `stage1_reply_timestamp` (PO confirmation stage)
7. Falls back to empty string `''` if all are blank.

### C. Outcome Resolution
- If the `outcome` column is populated, it uses that value.
- Otherwise, it evaluates the `delivery_variance_days` field:
  - If `variance <= 0`, outcome resolves to `'On time'`.
  - If `variance > 0`, outcome resolves to `'Delayed'`.

### D. Chronological Sorting & Slicing
- **Sorting**: Parsed dates are sorted chronologically in descending order (latest delivery date first):
  ```javascript
  recentDeliveries.sort((a, b) => parseDate(b.delivered) - parseDate(a.delivered));
  ```
- **Slicing**: Filters and returns only the top **10** most recent completed deliveries.

---

## 3. Frontend Presentation & UI Mappings

In **[SupplierDetail.jsx](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierDetail.jsx#L628-L673)**, the frontend maps the JSON array to the table elements:

1. **PO Number**: Renders `item.po` in the first column.
2. **Material Details**: Displays `item.materialName` in bold, and `item.materialCode` in smaller muted text underneath.
3. **Date Formatting**: Displays both dates (`Need by` and `Delivered`) formatted using `formatShortDate()` to show `[Day] [Month]` in New York timezone (e.g. `23 Jan`).
4. **Days Late**: Renders the numeric variance. If `item.daysLate > 0`, it adds a plus prefix (e.g. `+5` days). Otherwise, it displays the integer (e.g. `0` or `-2`).
5. **Outcome Badge**: Renders a pill badge showing the outcome text:
   - Green badge (class `.p-ontime`) if outcome is `'On time'`.
   - Red badge (class `.p-delayed`) if outcome is `'Delayed'`.
6. **PO Detail Link**: If `item.commsGroupId` exists, it makes the row clickable (class `.click` applying a light background hover highlight) and routes to:
   `navigate(`/detail/${item.commsGroupId}`)`
