import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate, formatTimestamp, getStatusPill } from './utils';

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function TrailComponent({ data }) {
  const h = data.header || {};
  const comm = data.communication || {};

  const stages = ['stage1', 'stage1_5', 'stage2', 'stage2_5', 'stage3'];
  const stageLabels = {
    stage1: 'PO confirmation',
    stage1_5: 'PO confirmation update',
    stage2: 'Order progress',
    stage2_5: 'Order progress update',
    stage3: 'Dispatch'
  };

  return (
    <div className="flex flex-col pl-[2px]">
      <div className="flex gap-[13px] pb-[22px] relative group">
        <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-emerald"></div>
        <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">PO issued</div>
          <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(h.issueDate || comm.issue_date)}</div>
        </div>
      </div>

      {stages.map(stageName => {
        // Collect all events for this stage
        const stageEvents = [];

        if (comm[`${stageName}_outreach_timestamp`]) {
          stageEvents.push({
            type: 'outreach',
            timestamp: comm[`${stageName}_outreach_timestamp`],
            title: 'Initial check-in email sent',
            channel: 'Email'
          });
        }

        [1, 2, 3].forEach(i => {
          const mailKey = `${stageName}_reminder_mail${i}_timestamp`;
          if (comm[mailKey]) {
            const label = i === 1 ? 'First' : i === 2 ? 'Second' : 'Third';
            stageEvents.push({
              type: 'reminder_email',
              index: i,
              timestamp: comm[mailKey],
              title: `${label} reminder email sent`,
              channel: 'Email'
            });
          }
        });

        [1, 2, 3].forEach(i => {
          const callKey = `${stageName}_reminder_call${i}_timestamp`;
          if (comm[callKey]) {
            const label = i === 1 ? 'First' : i === 2 ? 'Second' : 'Third';
            const answered = comm[`${stageName}_reminder_call${i}_answered`];
            const outcome = comm[`${stageName}_reminder_call${i}_call_outcome`];
            const isAnswered = answered === 'Yes';
            stageEvents.push({
              type: 'reminder_call',
              index: i,
              timestamp: comm[callKey],
              title: `${label} reminder call placed`,
              channel: 'Call',
              answered: answered,
              outcome: outcome,
              classification: comm[`${stageName}_reminder_call${i}_delivery_status_classification`],
              statusText: comm[`${stageName}_reminder_call${i}_delivery_status_text`],
              statement: comm[`${stageName}_reminder_call${i}_supplier_raw_statement`]
            });
          }
        });

        const replyMode = (comm[`${stageName}_mode_of_reply_received`] || '').toLowerCase();
        if (comm[`${stageName}_reply_timestamp`] && replyMode !== 'call') {
          stageEvents.push({
            type: 'reply',
            timestamp: comm[`${stageName}_reply_timestamp`],
            title: 'Supplier reply received',
            channel: 'Email',
            classification: comm[`${stageName}_delivery_status_classification`],
            statusText: comm[`${stageName}_delivery_status_text`],
            statement: comm[`${stageName}_supplier_raw_statement`]
          });
        }

        if (comm[`${stageName}_internal_escalation_sent`] === 'Yes' || comm[`${stageName}_internal_escalation_timestamp`]) {
          const escTs = comm[`${stageName}_internal_escalation_timestamp`] || comm[`${stageName}_reply_timestamp`] || '--';
          stageEvents.push({
            type: 'escalation',
            timestamp: escTs,
            title: 'Flagged for buyer review',
            channel: 'Escalated'
          });
        }

        if (stageEvents.length === 0) return null;

        // Sort events within the stage chronologically
        stageEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return (
          <React.Fragment key={stageName}>
            <div className="flex items-center gap-[10px] mt-[26px] mb-[15px] first:mt-[6px]">
              <span className="text-[12px] font-extrabold text-emerald uppercase tracking-[0.7px]">{stageLabels[stageName]}</span>
              <span className="flex-1 h-[1px] bg-line"></span>
            </div>
            <div className="flex flex-col pl-[2px]">
              {stageEvents.map((event, idx) => {
                if (event.type === 'outreach') {
                  return (
                    <div className="flex gap-[13px] pb-[22px] relative group" key="outreach">
                      <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-bright"></div>
                      <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                          Initial check-in email sent <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-[#EAF3EF] text-accent">Email</span>
                        </div>
                        <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(event.timestamp)}</div>
                        {!comm[`${stageName}_reply_timestamp`] && <div className="text-[12px] text-muted italic mt-[5px]">No reply received</div>}
                      </div>
                    </div>
                  );
                }

                if (event.type === 'reminder_email') {
                  return (
                    <div className="flex gap-[13px] pb-[22px] relative group" key={`mail-${event.index}`}>
                      <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-bright"></div>
                      <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                          {event.title} <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-[#EAF3EF] text-accent">Email</span>
                        </div>
                        <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(event.timestamp)}</div>
                        {!comm[`${stageName}_reply_timestamp`] && <div className="text-[12px] text-muted italic mt-[5px]">No reply received</div>}
                      </div>
                    </div>
                  );
                }

                if (event.type === 'reminder_call') {
                  const isAnswered = event.answered === 'Yes';
                  return (
                    <div className="flex gap-[13px] pb-[22px] relative group" key={`call-${event.index}`}>
                      <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-bright"></div>
                      <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                          {event.title} <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-goldfill text-darkgold">Call</span>
                        </div>
                        <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(event.timestamp)}</div>

                        {isAnswered ? (
                          <div className="text-[13px] text-[#0E5C44] font-bold mt-[5px]">Supplier responded on the call</div>
                        ) : (
                          <div className="text-[13px] text-red font-semibold mt-[5px]">
                            No reply received{event.outcome ? ` (${event.outcome.replace(/_/g, ' ')})` : ''}
                          </div>
                        )}

                        {isAnswered && (
                          <div className="bg-[#F6F7F6] border border-line rounded-[9px] py-[12px] px-[14px] mt-[9px] max-w-[540px]">
                            <div className={`inline-flex items-center gap-[6px] text-[11.5px] font-extrabold mb-[9px] ${event.classification?.toLowerCase().includes('delay') ? 'text-red' : event.classification?.toLowerCase().includes('risk') ? 'text-darkgold' : 'text-emerald'}`}>
                              <span className={`w-2 h-2 rounded-full inline-block ${event.classification?.toLowerCase().includes('delay') ? 'bg-red' : event.classification?.toLowerCase().includes('risk') ? 'bg-gold' : 'bg-bright'}`}></span>
                              {event.classification || 'On track'}
                            </div>
                            <div className="text-[13px] text-body font-bold leading-[1.4]">{event.statusText || '--'}</div>
                            {event.statement && (
                              <div className="mt-[9px] pl-[11px] border-l-2 border-line">
                                <div className="text-[10.5px] text-muted font-bold uppercase tracking-[0.4px] mb-[2px]">Call transcript snippet</div>
                                <div className="text-[13px] text-muted leading-[1.45] italic">"{event.statement}"</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (event.type === 'reply') {
                  return (
                    <div className="flex gap-[13px] pb-[22px] relative group" key="reply">
                      <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-bright"></div>
                      <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                          {event.title} <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-[#EAF3EF] text-accent">Email</span>
                        </div>
                        <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(event.timestamp)}</div>
                        <div className="bg-[#F6F7F6] border border-line rounded-[9px] py-[12px] px-[14px] mt-[9px] max-w-[540px]">
                          <div className={`inline-flex items-center gap-[6px] text-[11.5px] font-extrabold mb-[9px] ${event.classification?.toLowerCase().includes('delay') ? 'text-red' : event.classification?.toLowerCase().includes('risk') ? 'text-darkgold' : 'text-emerald'}`}>
                            <span className={`w-2 h-2 rounded-full inline-block ${event.classification?.toLowerCase().includes('delay') ? 'bg-red' : event.classification?.toLowerCase().includes('risk') ? 'bg-gold' : 'bg-bright'}`}></span>
                            {event.classification || 'On track'}
                          </div>
                          <div className="text-[13px] text-body font-bold leading-[1.4]">{event.statusText || '--'}</div>
                          {event.statement && (
                            <div className="mt-[9px] pl-[11px] border-l-2 border-line">
                              <div className="text-[10.5px] text-muted font-bold uppercase tracking-[0.4px] mb-[2px]">Supplier's response</div>
                              <div className="text-[13px] text-muted leading-[1.45] italic">"{event.statement}"</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (event.type === 'escalation') {
                  return (
                    <div className="flex gap-[13px] pb-[22px] relative group" key="escalation">
                      <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-bright"></div>
                      <div className="absolute left-[5px] top-[13px] bottom-[-3px] w-[1.5px] bg-line group-last:hidden"></div>
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                          Flagged for buyer review <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-redfill text-red">Escalated</span>
                        </div>
                        <div className="text-[12px] text-muted mt-[4px] font-medium">{formatTimestamp(event.timestamp)}</div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </React.Fragment>
        );
      })}

      {data.nextAction && data.nextAction !== 'Waiting' && data.nextAction !== '--' && (
        <React.Fragment>
          <div className="flex items-center gap-[10px] mt-[26px] mb-[15px]">
            <span className="text-[12px] font-extrabold text-emerald uppercase tracking-[0.7px]">Next Action</span>
            <span className="flex-1 h-[1px] bg-line"></span>
          </div>
          <div className="flex flex-col pl-[2px]">
            <div className="flex gap-[13px] pb-[22px] relative group last:pb-0">
              <div className="w-[10px] h-[10px] rounded-full mt-[4px] shrink-0 relative z-[1] bg-[#D2D8D4] border-[1.5px] border-[#B7C4BD]"></div>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-body flex items-center gap-2 flex-wrap leading-[1.3]">
                  Next touch point <span className="text-[10.5px] font-extrabold py-[1px] px-[7px] rounded-[10px] uppercase tracking-[0.4px] bg-[#EEF1EF] text-muted">Scheduled</span>
                </div>
                <div className="text-[12px] text-muted mt-[4px] font-medium">{data.nextAction}</div>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function PODetail() {
  const { commsGroupId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trail');

  useEffect(() => {
    const loadPODetail = async () => {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        navigate('/login');
        return;
      }

      if (!commsGroupId) {
        setError('No commsGroupId provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}?action=poDetails&commsGroupId=${encodeURIComponent(commsGroupId)}&sessionToken=${encodeURIComponent(token)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();

        console.log('PO Details API:', json);

        if (json.success === false && json.error === 'Unauthorized') {
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('companyName');
          navigate('/login');
          return;
        }

        if (json.success === false) {
          throw new Error(json.message || 'API returned success: false');
        }
        setData(json);
      } catch (err) {
        console.error('Failed to load PO:', err);
        setError('Unable to load PO details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadPODetail();
  }, [commsGroupId, navigate]);

  if (loading) {
    return (
      <div id="loading-state" className="text-center py-[100px] px-5 text-[16px] font-semibold text-muted">
        Loading PO details...
      </div>
    );
  }

  if (error) {
    return (
      <div id="error-state" className="text-center py-[100px] px-5 text-[16px] font-semibold text-red">
        {error}<br />Please try again.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const h = data.header || {};
  const s = data.supplier || {};
  const li = (data.lineItems || [])[0] || {};
  const comm = data.communication || {};

  const qty = li.quantity ? (li.uom ? `${li.quantity} ${li.uom}` : li.quantity) : '--';
  const statusPill = getStatusPill(comm);

  // Status pill classes
  let pillCls = "bg-[#EEF1EF] text-muted";
  if (statusPill.class === 'p-delayed') pillCls = "bg-redfill text-red";
  if (statusPill.class === 'p-risk') pillCls = "bg-goldfill text-darkgold";
  if (statusPill.class === 'p-ontime') pillCls = "bg-pale text-emerald";
  if (statusPill.class === 'p-await') pillCls = "bg-[#EAF0FB] text-[#3A5C9A]";

  return (
    <div className="mx-[96px] py-12">
      <div className="w-full max-w-[800px] mx-auto bg-white border border-line rounded-[16px] overflow-hidden shadow-[0_12px_40px_rgba(11,61,46,0.12)]" id="detail-panel">
        <div className="pt-[20px] px-[26px] pb-[18px] border-b border-line bg-[#FCFDFC]">
          <div className="flex items-start justify-between">
            <div className="text-[18px] font-extrabold text-emerald tracking-[-0.3px]">
              <span id="po-number">PO# {h.poNumber || '--'}</span>
              <span id="po-line" className="text-muted font-semibold text-[14px] ml-1">&middot; line item {li.poLineKey ? li.poLineKey.split('_').pop() : '1'}</span>
            </div>
            <div className="text-[20px] font-bold text-muted cursor-pointer leading-none hover:text-body" onClick={() => navigate(-1)}>&times;</div>
          </div>
          <div className="grid grid-cols-2 gap-x-[32px] gap-y-[13px] mt-[14px]">
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Supplier name</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-supplier">{h.supplier || '--'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Supplier code</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-code">{h.supplierCode || '--'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Material code</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-material-code">{li.materialCode || '--'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Material name</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-material-name">{li.materialName || '--'}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Quantity</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-qty">{qty}</span></div>
            <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">PO status</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="header-status">{h.status || 'Open'}</span></div>
          </div>
          <div className="mt-[15px] pt-[14px] border-t border-dashed border-line">
            <span className={`inline-block text-[12.5px] font-extrabold py-1 px-[11px] rounded-[20px] whitespace-nowrap ${pillCls}`} id="status-pill">{statusPill.text}</span>
            <div className="text-[14px] text-body font-semibold leading-[1.4] mt-[10px]" id="summary-text">{data.deliveryStatusText || comm.delivery_status_text || 'No status available'}</div>
          </div>
        </div>

        <div className="flex gap-1 pt-[12px] px-[26px] pb-0 border-b border-line">
          <button className={`text-[14px] font-bold text-muted pt-[9px] pb-[12px] px-[14px] border-b-[2.5px] border-transparent bg-none cursor-pointer hover:text-body ${activeTab === 'trail' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('trail')}>Communication trail</button>
          <button className={`text-[14px] font-bold text-muted pt-[9px] pb-[12px] px-[14px] border-b-[2.5px] border-transparent bg-none cursor-pointer hover:text-body ${activeTab === 'dates' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('dates')}>Other order details</button>
          <button className={`text-[14px] font-bold text-muted pt-[9px] pb-[12px] px-[14px] border-b-[2.5px] border-transparent bg-none cursor-pointer hover:text-body ${activeTab === 'supplier' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('supplier')}>Supplier details</button>
        </div>

        {activeTab === 'trail' && (
          <div className="py-[20px] px-[26px]" id="trail">
            <TrailComponent data={data} />
          </div>
        )}

        {activeTab === 'dates' && (
          <div className="py-[20px] px-[26px]" id="dates">
            <div className="grid grid-cols-3 gap-x-[32px] gap-y-[16px]">
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">PO issue date</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-issue">{formatDate(h.issueDate || comm.issue_date)}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Deliver-by date</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-deliver">{formatDate(li.deliverBy)}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Ship-by date</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-ship">{formatDate(li.shipBy)}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Delivery location</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-location">{comm.delivery_location || s.deliveryLocation || '--'}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Transit time (days)</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-transit">{comm.transit_time_days || '--'}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Tracking carrier</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-carrier">{li.carrier || '--'}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Tracking number</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-tracking">{li.trackingNumber || '--'}</span></div>
              {comm.promised_revert_date && (
                <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Promised check date</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-promised-revert">{formatDate(comm.promised_revert_date)}</span></div>
              )}
              {comm.supplier_colleague_email && (
                <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Delegated colleague</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-colleague">{comm.supplier_colleague_name ? `${comm.supplier_colleague_name} (${comm.supplier_colleague_email})` : comm.supplier_colleague_email}</span></div>
              )}
              {(() => {
                const stageName = h.followUpStage || 'Stage1';
                const p = stageName.toLowerCase().replace('.', '_') + '_';
                const conf = comm[p + 'supplier_reply_confidence'];
                if (conf) {
                  return (
                    <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Classification confidence</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-confidence">{conf}</span></div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {activeTab === 'supplier' && (
          <div className="py-[20px] px-[26px]" id="supplier">
            <div className="grid grid-cols-2 gap-x-[32px] gap-y-[16px]">
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Contact name</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-contact">{s.contactName || '--'}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Phone</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-phone">{s.phone || '--'}</span></div>
              <div className="flex flex-col col-span-2"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Email</span><span className="text-[14px] text-body font-semibold leading-[1.35]"><a href={s.email ? `mailto:${s.email}` : '#'} className="text-body hover:text-accent no-underline">{(s.email || '--')}</a></span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Source location</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-source">{s.sourceLocation || '--'}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-muted font-bold uppercase tracking-[0.5px] mb-[3px]">Working days</span><span className="text-[14px] text-body font-semibold leading-[1.35]" id="detail-working">{s.workingDays || '--'}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PODetail;
