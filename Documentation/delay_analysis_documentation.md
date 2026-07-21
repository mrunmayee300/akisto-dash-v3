# Delay Analysis Documentation: Client & Supplier Performance

This document explains the data source, backend aggregation, and frontend rendering logic for the **Delay Analysis** section on both the Client Performance page and the individual Supplier Detail page.

---

## 1. Mapped Google Sheet & Columns

All delay analysis data is retrieved from a single log sheet:

### Sheet: `Delay Event Logs`
Stores individual historical late-delivery events and their parsed root causes.

| Sheet Column Name | JSON Property | Description |
| :--- | :--- | :--- |
| `client_code` | `row.client_code` | Used to filter data for the active client session. |
| `supplier_code` | `row.supplier_code` | Identifies the supplier responsible for the order. |
| `delay_reason_category` | `category` | The root cause classification of the delay (e.g. `'Component Shortage'`, `'Capacity Constraint'`). |
| `delay_origin` | `side` | Determines who is responsible for the blocker: `'supplier'` or `'internal'`. |

---

## 2. Backend Aggregation Logic

The backend filters and aggregates the raw log rows into a sorted percentage list.

### A. Client Page (Global Delay Analysis)
* **Endpoint / Action**: `action=supplierPerformance`
* **Google Apps Script**:
  1. Filters `Delay Event Logs` where `client_code` matches the current session.
  2. Tallies the counts of each unique `delay_reason_category`.
  3. Maps the category to its responsibility side (`delay_origin`).
* **Node.js Backend**:
  1. Scopes the query to the logged-in buyer's assigned suppliers:
     ```javascript
     const filteredDelays = delayEventLogsRows.filter(
       row => normalize(row.client_code) === normalize(clientCode) && 
              assignedSupplierCodes.has(normalize(row.supplier_code))
     );
     ```
  2. If the buyer-specific list has entries, it aggregates those; if empty, it falls back to all client-wide delay logs.
* **Math Calculation**:
  $$\text{Percentage} = \text{Math.round}\left(\frac{\text{Count of Category}}{\text{Total Filtered Delays}} \times 100\right)$$
* **Sorting**: Sorts the list in descending order by `percentage`.

### B. Supplier Page (Supplier-Specific Delay Analysis)
* **Endpoint / Action**: `action=supplierDetail&supplierCode=...`
* **Logic**:
  1. Filters `Delay Event Logs` where `client_code` matches the active client AND `supplier_code` matches the requested supplier code:
     ```javascript
     const filteredDelays = delayEventLogsRows.filter(
       row => normalize(row.client_code) === normalize(clientCode) &&
              normalize(row.supplier_code) === normalize(supplierCode)
     );
     ```
  2. Counts occurrences of each `delay_reason_category`, resolves their origin (`delay_origin`), and computes their percentage share.
  3. Sorts the list in descending order by `percentage`.

---

## 3. Frontend Presentation & UI Mappings

Once the frontend receives the `delaySummary` array, it dynamically computes the legend splits and renders the visual bar charts:

### A. Total Split Computations
In **[SupplierPerformance.jsx](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierPerformance.jsx#L254-L260)**, the frontend sums up the percentages based on the `side` key:
- **Total Internal Blocker %**:
  ```javascript
  const totalInternal = delaySummary
    .filter(d => d.side === 'internal')
    .reduce((sum, d) => sum + d.percentage, 0);
  ```
- **Total Supplier-Side Blocker %**:
  ```javascript
  const totalSupplier = delaySummary
    .filter(d => d.side === 'supplier')
    .reduce((sum, d) => sum + d.percentage, 0);
  ```
- **Description rendered**:
  `Of all delays, [totalInternal]% were internal blockers and [totalSupplier]% were supplier-side issues.`

### B. Bar Chart Rendering
For each item in `delaySummary`, the frontend (**[SupplierPerformance.jsx](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierPerformance.jsx#L858-L870)** and **[SupplierDetail.jsx](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierDetail.jsx#L578-L593)**) renders:

1. **Responsibility Dot (`.src`)**:
   - Class `src-int` (Gold color `var(--gold)`) if `side === 'internal'`.
   - Class `src-sup` (Green color `var(--accent)`) if `side === 'supplier'`.
2. **Category Label**: Renders the text value of `category`.
3. **Horizontal Bar (`.rb > i`)**:
   - The fill width of the indicator is set inline: `style={{ width: `${d.percentage}%` }}`.
   - Class `int` (Gold background) if `side === 'internal'`.
   - Class `sup` (Green background) if `side === 'supplier'`.
4. **Value Label (`.rv`)**: Renders `d.percentage%` right-aligned.
5. **Legend**: Shows color keys mapping Internal blockers (Gold) and Supplier-side issues (Green).
