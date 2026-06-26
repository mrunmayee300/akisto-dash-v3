export function formatDate(value) {
  if (!value) return '--';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    
    const company = localStorage.getItem('companyName') || '';
    let timeZone = 'Asia/Kolkata';
    if (!company.toLowerCase().includes('emerald') && !company.toLowerCase().includes('biotique') && !company.toLowerCase().includes('sipat')) {
      timeZone = 'America/New_York';
    }
    
    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: timeZone });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: timeZone });
    const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: timeZone });
    return `${day} ${month} ${year}`;
  } catch (e) {
    return value;
  }
}

export function formatTimestamp(ts) {
  if (!ts) return '--';
  try {
    const hasTime = String(ts).includes(':') || String(ts).includes('T');
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    
    const company = localStorage.getItem('companyName') || '';
    let timeZone = 'Asia/Kolkata';
    let tzLabel = 'IST';
    if (!company.toLowerCase().includes('emerald') && !company.toLowerCase().includes('biotique') && !company.toLowerCase().includes('sipat')) {
      timeZone = 'America/New_York';
      tzLabel = 'EST';
    }
    
    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: timeZone });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: timeZone });
    const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: timeZone });
    const datePart = `${day} ${month} ${year}`;
    
    if (!hasTime) {
      return datePart;
    }
    
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timeZone });
    return `${datePart} · ${timePart} ${tzLabel}`;
  } catch (e) {
    return ts;
  }
}

export function getStatus(po) {
  const cls =
    po.stage3_delivery_status_classification ||
    po.stage2_5_delivery_status_classification ||
    po.stage2_delivery_status_classification ||
    po.stage1_5_delivery_status_classification ||
    po.stage1_delivery_status_classification ||
    '';

  const x = cls.toLowerCase();

  if (x === 'on time') {
    return { label: 'On time', cls: 'p-ontime' };
  }

  if (x.includes('tbc') || x.includes('soft') || x.includes('warning')) {
    return { label: 'On time · TBC', cls: 'p-tbc' };
  }

  if (x.includes('risk')) {
    return { label: 'At risk', cls: 'p-risk' };
  }

  if (x.includes('delay') || x.includes('late')) {
    return { label: 'Delayed', cls: 'p-delayed' };
  }

  if (x.includes('review') || x.includes('partial')) {
    return { label: 'Needs review', cls: 'p-review' };
  }

  return { label: 'Awaiting reply', cls: 'p-await' };
}

export function latestSupplierUpdate(po) {
  const text =
    po.stage3_delivery_status_text ||
    po.stage2_5_delivery_status_text ||
    po.stage2_delivery_status_text ||
    po.stage1_5_delivery_status_text ||
    po.stage1_delivery_status_text ||
    '';

  if (text) return text;

  if (po.stage3_supplier_reply_status === 'Received')
    return 'Supplier replied, awaiting review';

  if (po.stage2_supplier_reply_status === 'Received')
    return 'Supplier replied, awaiting review';

  if (po.stage1_supplier_reply_status === 'Received')
    return 'Supplier replied, awaiting review';

  return 'No supplier response yet';
}

export function nextTouchPoint(po) {
  return po.next_touch_point || 'Monitoring';
}

export function quantityText(po) {
  return `${po.quantity || po.qty || '--'} ${po.unit_of_measure || po.uom || ''}`.trim();
}

export function getStatusPill(comm) {
  const cls = (
    comm.stage3_delivery_status_classification ||
    comm.stage2_5_delivery_status_classification ||
    comm.stage2_delivery_status_classification ||
    comm.stage1_5_delivery_status_classification ||
    comm.stage1_delivery_status_classification ||
    ''
  ).toLowerCase();

  if (cls === 'on time') {
    return { text: 'On time', class: 'p-ontime' };
  }
  if (cls.includes('tbc') || cls.includes('soft') || cls.includes('warning')) {
    return { text: 'On time · TBC', class: 'p-tbc' };
  }
  if (cls.includes('risk')) {
    return { text: 'At risk', class: 'p-risk' };
  }
  if (cls.includes('delay') || cls.includes('late')) {
    return { text: 'Delayed', class: 'p-delayed' };
  }
  if (cls.includes('review') || cls.includes('partial')) {
    return { text: 'Needs review', class: 'p-review' };
  }
  return { text: 'Awaiting reply', class: 'p-await' };
}
