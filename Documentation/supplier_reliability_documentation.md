# Supplier Reliability Table Documentation

This document explains the data model, query scope, filtering, sorting, and pagination logic for the **Supplier Reliability Table** displayed under the "By Supplier" tab on the **Supplier Performance** page.

---

## 1. Mapped Google Sheet & Columns

The table fetches data from a single spreadsheet tab:

### Sheet: `Supplier Stats`
Contains aggregated historical stats compiled for each supplier.

| Column Name | JSON Property | Description |
| :--- | :--- | :--- |
| `client_code` | `s.client_code` | Filters rows matching the active client company. |
| `supplier_name` / `supplier_name_full` | `name` | The name of the supplier. |
| `supplier_code` | `code` | Unique identification code for the supplier. |
| `category` | `desc` | Classification or category description. |
| `total_po_lines` | `poLines` | Total PO line items tracked over the last 6 months. |
| `on_time_rate` | `onTime` | Percentage of lines completed on schedule. |
| `avg_days_late` | `avgDaysLate` | Average delay duration for late orders. |
| `avg_response_time_days` | `avgRespTime` | Average days taken by the supplier to reply to messages. |
| `escalated_rate` | `escalated` | Percentage of order lines that reached escalation level. |
| `performance_flag` | `flag` | Manually or externally set risk label (`Watch`, `Action Needed`, `Review`, `Monitor`). |
| `buyer_name` | — | (Node.js Backend only) Used to filter suppliers to the logged-in buyer agent. |

---

## 2. Data Resolution & Normalization

When the endpoint (`action=supplierPerformance`) is hit, the backend maps the raw spreadsheet columns. It handles value normalization dynamically:

1. **Percentage Conversion**: If the spreadsheet stores rates as integers (e.g. `85` for $85\%$) instead of decimals (e.g. `0.85`), the code checks if `rate > 1.5` and divides by 100.
2. **OTR Class Coding**: Categorizes OTR levels for UI coloring:
   - **`bad` (Red)**: On-Time Rate $< 60\%$
   - **`mid` (Yellow)**: On-Time Rate $60\% - 79\%$
   - **`good` (Green)**: On-Time Rate $\ge 80\%$

---

## 3. UI Visual Mappings & Display Information

The table renders the following data fields to the user:

1. **Supplier**: Renders the corporate supplier name (`name`) along with the unique code (`code`) formatted in a lighter gray text:
   - **Render**: `[Supplier Name] (S01)`
2. **PO lines ordered**: Renders the raw count of purchase order line items (`poLines`) right-aligned.
3. **On-time rate**: Displays the calculated percentage value along with a horizontal visual completion bar (`.ratebar`):
   - The fill width is bound to `onTime%`: `<i style={{ width: `${sup.onTime}%` }}></i>`.
   - The color classes match the resolved threshold classifications:
     - Class `good`: Green fill.
     - Class `mid`: Yellow/Gold fill.
     - Class `bad`: Red fill.
4. **Avg days late**: Displays `avgDaysLate` (formatted to one decimal point on the backend, e.g. `2.5`).
5. **Avg response time**: Displays the raw days taken to reply, suffixed with `' d'` (e.g. `1.2 d`).
6. **Escalated**: Displays the percentage value of escalated lines (e.g. `10%`).
7. **Flag**: Designates high-level alerts using generalized colored badge pills:
   - **`Action Needed` Badge (Red, class `.f-action`)**: Renders if the sheet `performance_flag` is either `'Watch'` or `'Action Needed'`.
   - **`Monitor` Badge (Yellow, class `.f-monitor`)**: Renders if the sheet `performance_flag` is either `'Review'` or `'Monitor'`.
   - **Blank**: Shows no badge if the supplier is unflagged.

---

## 4. Frontend Filtering Logic

The list of suppliers is filtered dynamically in React using the `useMemo` hook based on the user's active configuration:

1. **Text Search (`searchQuery`)**:
   Filters case-insensitively. A supplier matches if the query is a substring of the `supplier_name` or `supplier_code`:
   ```javascript
   const matchesSearch = !searchQuery ||
     (sup.name && sup.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
     (sup.code && String(sup.code).toLowerCase().includes(searchQuery.toLowerCase()));
   ```
2. **Alert Flag filtering (`filterFlag`)**:
   Generalizes the raw sheet flags into three main visual states:
   - **`Action Needed` Badge (Red)**: Mapped from `'Watch'` or `'Action Needed'` flags.
   - **`Monitor` Badge (Yellow)**: Mapped from `'Review'` or `'Monitor'` flags.
   - **Unflagged**: Mapped if no flag exists.
   - **Filter Application**:
     - `Action Needed`: Returns only rows resolving to the `Action Needed` state.
     - `Monitor`: Returns only rows resolving to the `Monitor` state.
     - `none`: Returns only unflagged rows.
     - `all`: Returns everything.

---

## 5. Frontend Sorting Logic

Sorting is processed in React using a secondary `useMemo` block when the `sortBy` header or select changes:

| Sort Key | Sorting Metric | Logic |
| :--- | :--- | :--- |
| **`rate_desc`** (Default) | On-time rate (Best first) | `b.onTime - a.onTime` |
| **`rate_asc`** | On-time rate (Worst first) | `a.onTime - b.onTime` |
| **`lines_desc`** | PO lines ordered (Highest first) | `b.poLines - a.poLines` |
| **`late_desc`** | Average days late (Highest first) | `parseFloat(b.avgDaysLate) - parseFloat(a.avgDaysLate)` |
| **`esc_desc`** | Escalated rate % (Highest first) | `parseFloat(b.escalated) - parseFloat(a.escalated)` |

### Stable Tie-Breaker:
If the sorting values are identical, the system applies a tie-breaker sorting algorithm:
1. Sorts **alphabetically** (A-Z) by `supplier_name`.
2. Sorts **alphabetically** (A-Z) by `supplier_code`.
3. Maintains original spreadsheet index alignment.

---

## 6. Pagination

To keep performance fast, the list is divided into pages:
* **Page Size**: `SUPPLIER_PAGE_SIZE = 15`.
* **Controls**:
  - Previous (`<`) button: disabled if `page <= 1`.
  - Next (`>`) button: disabled if `page >= totalSupplierPages`.
  - Displays progress indicators showing the visible subset, e.g. `"Showing 1–15 of 45 suppliers"`.
