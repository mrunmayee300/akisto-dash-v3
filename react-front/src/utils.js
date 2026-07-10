export function formatDate(value) {
  if (!value) return '--';
  try {
    const str = String(value).trim();
    let d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, dVal] = str.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, dVal));
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [m, dVal, y] = str.split('/').map(Number);
      d = new Date(Date.UTC(y, m - 1, dVal));
    } else {
      d = new Date(value);
    }

    if (isNaN(d.getTime())) return value;

    const hasTime = str.includes(':') || str.includes('T') || (str.includes(' ') && str.match(/\d{2}:\d{2}/));
    const timeZone = hasTime ? 'America/New_York' : 'UTC';

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
    const str = String(ts).trim();
    let d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, dVal] = str.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, dVal));
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [m, dVal, y] = str.split('/').map(Number);
      d = new Date(Date.UTC(y, m - 1, dVal));
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return ts;

    const hasTime = str.includes(':') || str.includes('T') || (str.includes(' ') && str.match(/\d{2}:\d{2}/));
    const timeZone = hasTime ? 'America/New_York' : 'UTC';

    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: timeZone });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: timeZone });
    const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: timeZone });
    const datePart = `${day} ${month} ${year}`;

    if (!hasTime) {
      return datePart;
    }

    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timeZone });
    
    // Get dynamic timezone label (EST or EDT)
    let tzLabel = 'EST';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(d);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      if (tzPart) {
        tzLabel = tzPart.value;
      }
    } catch (e) {
      // fallback to EST
    }

    return `${datePart} · ${timePart} ${tzLabel}`;
  } catch (e) {
    return ts;
  }
}

export function resolvePoDashboardState(po) {
  const stage = po.follow_up_stage || 'Stage1';
  const prefix = stage.toLowerCase().replace('.', '_') + '_';
  
  const classification = po[prefix + 'delivery_status_classification'] || '';
  const classificationLower = classification.toLowerCase();
  const status = po.follow_up_status || '';
  const statusLower = status.toLowerCase();
  
  const needsHumanReview = po.needs_human_review && String(po.needs_human_review).trim().toLowerCase() === 'yes';
  const humanReviewStatus = po.human_review_status && String(po.human_review_status).trim().toLowerCase() === 'pending';
  const isEscalated = statusLower === 'escalation_sent';
  const isLowConfidence = po[prefix + 'supplier_reply_confidence'] && String(po[prefix + 'supplier_reply_confidence']).trim().toLowerCase() === 'low';

  const isNeedsAttention = needsHumanReview || humanReviewStatus || isEscalated || 
                           classificationLower.includes('delay') || 
                           classificationLower.includes('late') ||
                           isLowConfidence;

  // 1. Needs Attention Bucket
  if (isNeedsAttention) {
    let subStatus = 'Needs Review';
    if (classificationLower === 'unclear') {
      subStatus = 'Unclear Response';
    } else if (isLowConfidence) {
      subStatus = 'Low Confidence';
    } else if (classificationLower.includes('delay') || classificationLower.includes('late')) {
      subStatus = 'Delayed';
    } else if (isEscalated) {
      subStatus = 'No Response';
    }

    let label = 'Needs review';
    let cls = 'p-review';
    let reason = po[prefix + 'delivery_status_text'] || 'Flagged for reviewer audit.';

    if (subStatus === 'Unclear Response') {
      label = 'Unclear response';
      cls = 'p-unclear';
      reason = po[prefix + 'delivery_status_text'] || 'AI clarification attempts failed or unclear response received.';
    } else if (subStatus === 'Low Confidence') {
      label = 'Low confidence';
      cls = 'p-low-confidence';
      reason = po[prefix + 'delivery_status_text'] || 'AI classification confidence is Low; review required.';
    } else if (subStatus === 'Delayed') {
      label = 'Delayed';
      cls = 'p-delayed';
      reason = po[prefix + 'delivery_status_text'] || 'Delivery delayed.';
    } else if (subStatus === 'No Response') {
      label = 'No Response';
      cls = 'p-no-response';
      reason = 'No reply despite repeated follow-up emails and calls.';
    }

    return {
      status: 'Needs Attention',
      label,
      cls,
      subStatus,
      reason
    };
  }

  // Helper check for Stage 1.5/2.5
  const isPassiveStage = ['Stage1.5', 'Stage2.5', 'stage1.5', 'stage2.5'].includes(stage);
  const hasReply = (po[prefix + 'reply_timestamp'] && po[prefix + 'reply_timestamp'] !== '') ||
                   (po[prefix + 'supplier_reply_status'] && String(po[prefix + 'supplier_reply_status']).trim().toLowerCase() === 'received');

  // 2. On Track Bucket
  const confirmedClassifications = ['on time', 'on time tbc', 'shipped tbc'];
  const isOnTrackState = (!isPassiveStage && confirmedClassifications.includes(classificationLower)) ||
                         (isPassiveStage && !hasReply) ||
                         (isPassiveStage && hasReply && confirmedClassifications.includes(classificationLower));

  if (isOnTrackState) {
    let label = isPassiveStage && !hasReply ? 'On track' : 'On time';
    let cls = 'p-ontime';
    
    if (classificationLower.includes('tbc') || classificationLower.includes('soft') || classificationLower.includes('warning') || classificationLower.includes('shipped')) {
      label = 'On time · TBC';
      cls = 'p-tbc';
    } else if (classificationLower.includes('risk')) {
      label = 'At risk';
      cls = 'p-risk';
    }

    return {
      status: 'On Track',
      label,
      cls,
      subStatus: isPassiveStage && !hasReply ? 'Monitoring' : 'Confirmed',
      reason: po[prefix + 'delivery_status_text'] || 'Delivery is currently on schedule.'
    };
  }

  // 3. Awaiting Reply Bucket
  let subStatus = 'Chasing Response';
  let reason = '';
  if (statusLower === 'replied') {
    reason = 'Awaiting classification';
  } else {
    const cleanStatus = status.replace(/_Sent$/i, '').replace(/_/g, ' ');
    const readableStatus = cleanStatus.replace(/([A-Za-z]+)(\d+)/g, '$1 $2');
    reason = `Chasing (${readableStatus})`;
  }
  let label = 'Awaiting reply';
  let cls = 'p-await';

  if (status === 'Clarification_Sent') {
    subStatus = 'Clarification in progress';
    reason = 'Waiting for clarification';
    label = 'Awaiting Clarification';
  } else if (classificationLower === 'awaiting_reply') {
    if (po.supplier_colleague_email) {
      subStatus = 'Delegated to Colleague';
      reason = `Chasing colleague: ${po.supplier_colleague_email}`;
    } else {
      const revertDate = po.promised_revert_date || po[prefix + 'promised_revert_date'] || '';
      if (revertDate) {
        subStatus = 'Promised Check Date';
        reason = `Awaiting promised update on ${formatDate(revertDate)}`;
      } else {
        subStatus = 'Promised Check Date';
        reason = 'Awaiting promised check';
      }
    }
  } else if (isPassiveStage && hasReply) {
    subStatus = 'Awaiting Reply';
    reason = po[prefix + 'delivery_status_text'] || 'Waiting for reply classification.';
  }

  return {
    status: 'Awaiting Reply',
    label,
    cls,
    subStatus,
    reason
  };
}

export function getStatus(po) {
  const resolved = resolvePoDashboardState(po);
  return { label: resolved.label, cls: resolved.cls };
}

export function latestSupplierUpdate(po) {
  const resolved = resolvePoDashboardState(po);
  return resolved.reason;
}

export function nextTouchPoint(po) {
  const resolved = resolvePoDashboardState(po);
  return resolved.reason;
}

export function quantityText(po) {
  return `${po.quantity || po.qty || '--'} ${po.unit_of_measure || po.uom || ''}`.trim();
}

export function getStatusPill(comm) {
  const resolved = resolvePoDashboardState(comm);
  return { text: resolved.label, class: resolved.cls };
}

export function latestStatusText(po) {
  return (
    po.stage3_delivery_status_text ||
    po.stage2_5_delivery_status_text ||
    po.stage2_delivery_status_text ||
    po.stage1_5_delivery_status_text ||
    po.stage1_delivery_status_text ||
    ''
  );
}

export function determineNextAction(po) {
  return po.next_action || '--';
}

export function getCleanFlag(flag) {
  const f = String(flag || '').trim().toLowerCase();
  if (f === 'watch' || f === 'action needed' || f === 'action_needed' || f === 'actionneeded') {
    return 'Action Needed';
  }
  if (f === 'review' || f === 'monitor') {
    return 'Monitor';
  }
  return '';
}




