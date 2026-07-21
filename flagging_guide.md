# Supplier Flagging — Complete Guide

## What Is a Flag?

A **flag** is a single text value stored in the `performance_flag` column of the **`Supplier Stats`** Google Sheet. It is a manually or externally assigned label that categorises a supplier's risk level. The dashboard reads this value and uses it to drive:

1. The **pill badge** in the Supplier Reliability table
2. The **graph line/fill colour** on the Supplier Detail page
3. The **header badge** on the Supplier Detail page
4. The **Filter dropdown** on the Supplier Performance page

---

## Where the Flag Lives

| Sheet | Column | Set By |
|---|---|---|
| `Supplier Stats` | `performance_flag` | **Manually** — entered directly into the sheet. There is no automated workflow that writes this column. |

The flag is read in two places in code:

- **`apps_script.js`** (line 174): `flag: s.performance_flag || ''`
- **`supplier.controller.js`** (line 120 / line 301): `flag: s.performance_flag || ''`

Both pass it through unchanged to the frontend as the `flag` field on each supplier object.

---

## Valid Flag Values

The dashboard recognises these specific string values:

| Value stored in sheet | Meaning | Where it renders |
|---|---|---|
| `"Watch"` | Supplier needs attention | 🔴 **Action Needed** pill (red) |
| `"Action Needed"` | Same as Watch | 🔴 **Action Needed** pill (red) |
| `"Monitor"` | Supplier is borderline, keep an eye | 🟡 **Monitor** pill (gold) |
| `"Review"` | Same as Monitor | 🟡 **Monitor** pill (gold) |
| `""` (empty / not set) | No flag | Nothing shown |

> [!IMPORTANT]
> Any value that is **not** one of the four above is silently ignored — no pill will be shown. Typos in the sheet (e.g. `"monitor"` lowercase) will result in no flag being displayed.

---

## Flag Rendering — Supplier Reliability Table

In [`SupplierPerformance.jsx`](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierPerformance.jsx#L946-L951):

```jsx
{(sup.flag === 'Watch' || sup.flag === 'Action Needed') && (
  <span className="flag f-action">Action Needed</span>   // → red pill
)}
{(sup.flag === 'Review' || sup.flag === 'Monitor') && (
  <span className="flag f-monitor">Monitor</span>         // → gold pill
)}
```

CSS classes:
- `.f-action` → `background: var(--redfill); color: var(--red)` → `#F7E7E3` / `#B23B2E`
- `.f-monitor` → `background: var(--goldfill); color: var(--darkgold)` → `#FBF4E2` / `#8A6516`

---

## Flag Rendering — Supplier Detail Page (Header Badge)

In [`SupplierDetail.jsx`](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierDetail.jsx#L502-L507):

```jsx
{supplierMeta.flag === 'Watch' || supplierMeta.flag === 'Action Needed' && (
  <span className="flag f-action">Action Needed</span>
)}
{supplierMeta.flag === 'Review' || supplierMeta.flag === 'Monitor' && (
  <span className="flag f-monitor">Monitor</span>
)}
```

This is the pill badge shown top-right of the supplier name header (as seen in your screenshot — "MONITOR" in gold).

---

## Flag Rendering — Graph Line Colour (Supplier Detail)

The flag **also drives the graph line colour** on the detail page chart. In [`SupplierDetail.jsx`](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierDetail.jsx#L118-L122):

```js
const supplierFlag = supplierMeta.flag || '';
const isMonitor = supplierFlag === 'Monitor' || supplierFlag === 'Review';
const isWatch   = supplierFlag === 'Watch'   || supplierFlag === 'Action Needed';

const strokeColor      = isWatch ? '#B23B2E' : isMonitor ? '#C79A2E' : '#0E5C44';
const fillOpacityColor = isWatch ? '#B23B2E' : isMonitor ? '#C79A2E' : '#1D9E75';
```

| Flag | Graph stroke + fill |
|---|---|
| `Watch` / `Action Needed` | 🔴 Red `#B23B2E` |
| `Monitor` / `Review` | 🟡 Gold `#C79A2E` |
| Empty / other | 🟢 Green `#0E5C44` / `#1D9E75` |

This matches what you see in the screenshot — "Premier Polymers" (MONITOR) has a **dark green** chart, but that's because the flag wasn't yet driving colour at the time. After the fix, a **Monitor** supplier will now show a gold graph.

---

## Rate Bar Colour — On-Time Rate Column (Separate System)

The coloured bar next to the `%` in the On-time rate column is **not** driven by the flag. It is driven independently by `on_time_rate`:

In [`apps_script.js`](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/apps_script.js#L164):

```js
var rateClass = onTimeRate < 0.6  ? 'bad'  :   // → red bar
               (onTimeRate < 0.8  ? 'mid'  :   // → gold bar
                                    'good');   // → green bar
```

| `on_time_rate` | Bar class | Bar colour |
|---|---|---|
| < 60% | `bad` | 🔴 Red (`--red`) |
| 60%–79% | `mid` | 🟡 Gold (`--gold`) |
| ≥ 80% | `good` | 🟢 Green (`--bright`) |

This is purely a computed display — it does **not** affect `performance_flag` and is not stored anywhere.

---

## Filter Dropdown — How It Maps

The "Flag" filter on the Supplier Performance page maps the stored values:

In [`SupplierPerformance.jsx`](file:///c:/Users/Mrunmayee/OneDrive/Desktop/AKISTO-ALL/akisto-dash-v3/dash-front/react-front/src/SupplierPerformance.jsx#L129-L140):

```js
const mappedFlag =
  (sup.flag === 'Watch' || sup.flag === 'Action Needed') ? 'Action Needed' :
  (sup.flag === 'Review' || sup.flag === 'Monitor')      ? 'Monitor'       :
  '';

if (filterFlag === 'Action Needed') return mappedFlag === 'Action Needed';
if (filterFlag === 'Monitor')       return mappedFlag === 'Monitor';
if (filterFlag === 'none')          return !mappedFlag;
return true; // 'all'
```

So regardless of whether the sheet says `"Watch"` or `"Action Needed"`, the filter option **"Action Needed"** will capture both.

---

## Who Sets the Flag?

> [!IMPORTANT]
> **The `performance_flag` column is set manually in the `Supplier Stats` sheet.** No automation, no workflow, no formula in any of the n8n workflows sets this value. It is a human judgment call entered directly into the sheet by whoever manages the data.

There is no logic in `apps_script.js`, `supplier.controller.js`, or any of the workflow JSON files in `updated_workflows/` that writes or updates `performance_flag`. The workflows deal with:
- PO follow-up actions (emails, calls)
- Delivery status classification
- Stage transitions (Stage 1 → 1.5 → 2 → 2.5 → 3)

**None of them touch supplier-level flags.**

---

## Complete Data Flow

```
Google Sheet: "Supplier Stats"
  Column: performance_flag
  Value: "Monitor" | "Watch" | "Action Needed" | "Review" | ""
  Written by: MANUALLY by data team
         │
         │ read by apps_script.js (supplierPerformance / supplierDetail action)
         │ OR supplier.controller.js (getSuppliers / getSupplierByCode)
         ▼
  JSON field: { flag: "Monitor" }
  Passed to frontend in:
    - suppliers[] array  (Supplier Performance page)
    - supplierMeta{}     (Supplier Detail page)
         │
         ├── Supplier Reliability Table
         │     flag === 'Watch' | 'Action Needed' → 🔴 "Action Needed" pill
         │     flag === 'Monitor' | 'Review'       → 🟡 "Monitor" pill
         │     flag empty                          → nothing shown
         │
         ├── Filter Dropdown
         │     maps both Watch/Action Needed → "Action Needed" filter bucket
         │     maps both Monitor/Review       → "Monitor" filter bucket
         │
         ├── Supplier Detail Header Badge
         │     same pill logic as table
         │
         └── Supplier Detail Graph Colour
               Watch / Action Needed → red line + fill
               Monitor / Review      → gold line + fill
               empty                 → green line + fill (default)
```

---

## Summary of Rules

| What you see | Triggered by |
|---|---|
| 🔴 Red pill "Action Needed" | `performance_flag` = `"Watch"` or `"Action Needed"` |
| 🟡 Gold pill "Monitor" | `performance_flag` = `"Monitor"` or `"Review"` |
| No pill | `performance_flag` is empty or any other value |
| 🔴 Red bar next to on-time % | `on_time_rate < 60%` (computed, unrelated to flag) |
| 🟡 Gold bar next to on-time % | `on_time_rate` between 60%–79% (computed, unrelated to flag) |
| 🔴 Red graph line | flag is Watch/Action Needed |
| 🟡 Gold graph line | flag is Monitor/Review |
| 🟢 Green graph line | no flag set |
