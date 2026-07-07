import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatTimestamp, quantityText, getStatus, latestSupplierUpdate, nextTouchPoint, resolvePoDashboardState, latestStatusText, determineNextAction } from './utils';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const PAGE_SIZE = 10;

const labels = {
  open: 'Open POs',
  attn: 'Needs attention',
  track: 'On track',
  await: 'Awaiting reply'
};

function formatCurrentDate() {
  const d = new Date();
  const timeZone = 'America/New_York';

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone });
  const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone });
  const month = d.toLocaleDateString('en-US', { month: 'long', timeZone });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone });

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

  return `${weekday}, ${day} ${month} · ${time} ${tzLabel}`;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('open');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState({
    open: 1,
    attn: 1,
    track: 1,
    await: 1
  });
  const [currentDateStr, setCurrentDateStr] = useState(formatCurrentDate());

  const userEmail = localStorage.getItem('userEmail');
  const companyName = localStorage.getItem('companyName');
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await fetch(`${APPS_SCRIPT_URL}?action=dashboard&sessionToken=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();

      console.log('Dashboard API:', json);

      if (json.success === false && json.error === 'Unauthorized') {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('companyName');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (json.success === false) {
        throw new Error(json.message || 'API returned success: false');
      }
      setData(json);
    } catch (err) {
      console.error('Dashboard API Error:', err);
      setError('Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000); // Poll every 30 seconds

    const timeInterval = setInterval(() => {
      setCurrentDateStr(formatCurrentDate());
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('companyName');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  if (loading) {
    return (
      <div id="loading-state" className="text-center py-[100px] px-5 text-[16px] font-semibold text-muted">
        Loading dashboard...
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

  // Sort the full list once into a stable ordering based on PO number and line item
  const sortedOpenPOs = [...(data.openPOs || [])].sort((a, b) => {
    const poA = String(a.po_number || '').trim();
    const poB = String(b.po_number || '').trim();
    const poCompare = poA.localeCompare(poB, undefined, { numeric: true, sensitivity: 'base' });
    if (poCompare !== 0) return poCompare;

    const lineA = String(a.po_line_item || '').trim();
    const lineB = String(b.po_line_item || '').trim();
    return lineA.localeCompare(lineB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const openPOs = sortedOpenPOs;
  
  // Re-classify on the frontend to ensure 100% correct tab grouping
  const needsAttention = [];
  const onTrack = [];
  const awaitingReply = [];
  
  openPOs.forEach(po => {
    const resolved = resolvePoDashboardState(po);
    if (resolved.status === 'Needs Attention') {
      needsAttention.push(po);
    } else if (resolved.status === 'On Track') {
      onTrack.push(po);
    } else {
      awaitingReply.push(po);
    }
  });

  const getPageData = (list, tabKey) => {
    const total = list.length;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(pages[tabKey] || 1, maxPage);
    const start = (currentPage - 1) * PAGE_SIZE;
    const sliced = list.slice(start, start + PAGE_SIZE);
    return { sliced, currentPage, maxPage };
  };

  const handlePageClick = (tabKey, p) => {
    setPages(prev => ({ ...prev, [tabKey]: p }));
  };

  const renderReactPager = (tabKey, total) => {
    const max = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = pages[tabKey] || 1;

    const pageList = [];
    const window = 1;
    pageList.push(1);
    if (current - window > 2) pageList.push('...');
    for (let p = Math.max(2, current - window); p <= Math.min(max - 1, current + window); p++) {
      pageList.push(p);
    }
    if (current + window < max - 1) pageList.push('...');
    if (max > 1) pageList.push(max);

    return (
      <>
        <button disabled={current <= 1} onClick={() => handlePageClick(tabKey, Math.max(1, current - 1))} className="font-inherit text-[13px] font-bold text-muted bg-white border border-line rounded-[7px] min-w-[28px] w-7 h-7 px-[7px] cursor-pointer leading-none disabled:opacity-40 disabled:cursor-default hover:not-disabled:border-accent hover:not-disabled:text-accent">&lt;</button>
        {pageList.map((p, idx) => {
          if (p === '...') {
            return <span key={`gap-${idx}`} className="text-[13px] text-muted px-[3px] select-none">...</span>;
          }
          return (
            <button key={p} className={`font-inherit text-[13px] font-bold text-muted bg-white border border-line rounded-[7px] min-w-[28px] w-7 h-7 px-[7px] cursor-pointer leading-none disabled:opacity-40 disabled:cursor-default hover:not-disabled:border-accent hover:not-disabled:text-accent ${p === current ? '!bg-emerald !border-emerald !text-white' : ''}`} onClick={() => handlePageClick(tabKey, p)}>
              {p}
            </button>
          );
        })}
        <button disabled={current >= max} onClick={() => handlePageClick(tabKey, Math.min(max, current + 1))} className="font-inherit text-[13px] font-bold text-muted bg-white border border-line rounded-[7px] min-w-[28px] w-7 h-7 px-[7px] cursor-pointer leading-none disabled:opacity-40 disabled:cursor-default hover:not-disabled:border-accent hover:not-disabled:text-accent">&gt;</button>
      </>
    );
  };

  const handleRowClick = (commsGroupId, statusLabel) => {
    const encodedId = encodeURIComponent(commsGroupId);
    if (statusLabel === 'Awaiting reply') {
      navigate(`/detail/${encodedId}?status=awaiting`);
    } else if (statusLabel === 'Delayed' || statusLabel === 'At risk' || statusLabel === 'Needs review') {
      navigate(`/detail/${encodedId}?status=delayed`);
    } else if (statusLabel === 'On time' || statusLabel === 'On track' || statusLabel === 'On time · TBC') {
      navigate(`/detail/${encodedId}?status=ontime`);
    } else {
      navigate(`/detail/${encodedId}?status=delayed`);
    }
  };

  const renderTableRows = (list, tabKey, showExtraColumn = false) => {
    const { sliced } = getPageData(list, tabKey);

    if (sliced.length === 0) {
      let emptyText = "Nothing needs attention right now";
      if (tabKey === 'open') emptyText = "No open POs found";
      if (tabKey === 'track') emptyText = "No POs are currently on track";
      if (tabKey === 'await') emptyText = "No POs are awaiting reply";

      const colSpan = showExtraColumn ? (tabKey === 'await' ? 9 : 8) : 7;
      return (
        <tr>
          <td colSpan={colSpan} className="text-center p-[30px] text-muted font-semibold">
            {emptyText}
          </td>
        </tr>
      );
    }

    return sliced.map(po => {
      const resolved = resolvePoDashboardState(po);
      const status = { label: resolved.label, cls: resolved.cls };
      const supplierText = po.supplier_code ? `${po.supplier_name} (${po.supplier_code})` : po.supplier_name;
      const dateValue = tabKey === 'track' ? po.ship_by_date_delivery_1 : po.deliver_by_date_delivery_1;

      // Status pill colors
      let pillCls = "bg-[#F1F5F9] text-[#475569]"; // Slate gray for fallback / Needs review
      if (status.cls === 'p-delayed') pillCls = "bg-redfill text-red";
      if (status.cls === 'p-no-response') pillCls = "bg-goldfill text-darkgold";
      if (status.cls === 'p-unclear') pillCls = "bg-purplefill text-purple";
      if (status.cls === 'p-low-confidence') pillCls = "bg-canvas text-lowconftext";
      if (status.cls === 'p-risk') pillCls = "bg-goldfill text-darkgold";
      if (status.cls === 'p-ontime') pillCls = "bg-pale text-emerald";
      if (status.cls === 'p-await') pillCls = "bg-[#EAF0FB] text-[#3A5C9A]";

      const pxCls = 'px-4';

      return (
        <tr key={po.comms_group_id} onClick={() => handleRowClick(po.comms_group_id, status.label)} className="cursor-pointer hover:bg-[#FDFDFD]">
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top font-extrabold text-emerald whitespace-nowrap min-w-[80px]`}>{po.po_number || '--'}</td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top font-bold text-body min-w-[150px] max-w-[220px] break-words`}>{supplierText || '--'}</td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[13.5px] align-top text-body font-bold whitespace-nowrap min-w-[100px]`}>{po.material_code || '--'}</td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[13.5px] align-top text-body min-w-[200px] max-w-[320px]`}>
            <div className="leading-[1.4] break-words">
              {po.material_name || '--'}
            </div>
          </td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top text-body font-semibold whitespace-nowrap min-w-[90px]`}>{quantityText(po)}</td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top text-body font-semibold whitespace-nowrap min-w-[100px]`}>{formatDate(dateValue)}</td>
          <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top min-w-[110px]`}>
            <span className={`inline-block text-[13px] font-extrabold p-1 px-[11px] rounded-[20px] whitespace-nowrap ${pillCls}`}>
              {status.label}
            </span>
          </td>
          {showExtraColumn && tabKey === 'attn' && (
            <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top text-body min-w-[220px] max-w-[380px] leading-[1.45] break-words`}>
              {resolved.reason || po.delivery_status_text || '--'}
            </td>
          )}
          {showExtraColumn && tabKey === 'track' && (
            <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top text-body min-w-[200px] max-w-[340px] leading-[1.45] break-words`}>
              {latestStatusText(po) || po.delivery_status_text || 'No status available'}
            </td>
          )}
          {showExtraColumn && tabKey === 'await' && (
            <>
              <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[13.5px] align-top text-body min-w-[200px] max-w-[340px] leading-[1.4] break-words`}>
                {po.latest_update_text ? (
                  <div className="flex flex-col gap-[3px]">
                    <div className="font-semibold">{po.latest_update_text}</div>
                    {po.latest_update_timestamp && (
                      <div className="text-[11px] text-muted font-medium">
                        {formatTimestamp(po.latest_update_timestamp)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted italic">No supplier response yet</span>
                )}
              </td>
              <td className={`p-[13px] ${pxCls} border-b border-[#F2F4F2] text-[14.5px] align-top text-emerald font-semibold min-w-[150px] max-w-[250px] leading-[1.4] break-words`}>
                {determineNextAction(po)}
              </td>
            </>
          )}
        </tr>
      );
    });
  };

  const getShowingText = (list, tabKey) => {
    const total = list.length;
    if (total === 0) return 'Showing 0 of 0';
    const { currentPage } = getPageData(list, tabKey);
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col mx-[96px]">
      <header className="flex items-center justify-between p-[18px] px-7 border-b border-line">
        <div className="flex items-center gap-[13px]">
          <span className="text-[23px] font-extrabold text-emerald tracking-[-0.5px]">akisto<span className="text-gold">.</span></span>
          <span className="text-[14.5px] text-muted font-semibold border-l border-line pl-[13px]">{labels[activeTab]}</span>
          <button
            onClick={() => navigate('/supplier-performance')}
            className="ml-4 bg-emerald text-white px-3 py-1 rounded text-[12px] font-bold transition-all hover:bg-accent"
          >
            Supplier Performance
          </button>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold text-body">
            {userName && userRole ? `${userName} . ${userRole}` : userName || userEmail}
          </div>
          <div className="text-[13px] text-muted mt-0.5 flex items-center justify-end gap-2.5">
            <span id="current-date">{currentDateStr}</span>
            <button id="logout-btn" onClick={handleLogout} className="bg-none border border-line p-0.5 px-2 rounded text-muted text-[11px] font-semibold cursor-pointer transition-all duration-200 hover:bg-canvas">Logout</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[1.45fr_1fr] gap-[14px] pt-[20px] px-7 pb-[6px]">
        <div className="rounded-xl p-[15px] px-[18px] bg-pale border border-[#C5E3D4]">
          <div className="flex items-center gap-2 text-[12.5px] font-extrabold tracking-[1px] uppercase mb-[11px] text-emerald">
            <span className="w-[19px] h-[19px] rounded-[5px] bg-emerald relative inline-flex items-center justify-center">
              <i className="text-white not-italic font-extrabold text-[12px] leading-none">a</i>
              <b className="absolute right-[-2px] bottom-[-1px] w-[5px] h-[5px] rounded-full bg-gold"></b>
            </span>
            <span>Summary</span>
          </div>
          <div className="text-[17px] font-extrabold text-darkgold leading-[1.34] mb-3">4 of the 20 stalled POs are awaiting your action, not the supplier's.</div>
          <div className="flex flex-col gap-[9px]">
            <div className="flex items-start gap-2.5 text-[15px] text-body leading-[1.3]"><span className="w-3.5 text-center font-extrabold flex-shrink-0 leading-[1.3] text-gold">&bull;</span><span>3 held on unreleased payments</span></div>
            <div className="flex items-start gap-2.5 text-[15px] text-body leading-[1.3]"><span className="w-3.5 text-center font-extrabold flex-shrink-0 leading-[1.3] text-gold">&bull;</span><span>1 on an unsigned revised PO</span></div>
            <div className="flex items-start gap-2.5 text-[15px] text-emerald font-bold leading-[1.3]"><span className="w-3.5 text-center font-extrabold flex-shrink-0 leading-[1.3] text-emerald">&#10003;</span><span>Clearing them frees 9 line items before their ship dates</span></div>
          </div>
        </div>
        <div className="rounded-xl p-[15px] px-[18px] bg-[#F5F8F6] border border-line">
          <div className="flex items-center gap-2 text-[12.5px] font-extrabold tracking-[1px] uppercase mb-[11px] text-muted"><span>What changed since yesterday</span></div>
          <div className="flex flex-col gap-[9px]">
            <div className="flex items-center gap-[9px] text-[15px] text-body"><span className="w-4 text-center font-extrabold text-red">&#9660;</span><span><b className="font-bold">3 POs</b> slipped to delayed</span></div>
            <div className="flex items-center gap-[9px] text-[15px] text-body"><span className="w-4 text-center font-extrabold text-bright">&#9650;</span><span><b className="font-bold">1 PO</b> recovered to on track</span></div>
            <div className="flex items-center gap-[9px] text-[15px] text-body"><span className="w-4 text-center font-extrabold text-gold">&#216;</span><span><b className="font-bold">2 suppliers</b> went silent past ship-by</span></div>
            <div className="flex items-center gap-[9px] text-[15px] text-body"><span className="w-4 text-center font-extrabold text-accent">&#43;</span><span><b className="font-bold">4 new replies</b> captured and classified</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-[13px] pt-[14px] px-7 pb-[6px]">
        <div className="border border-line rounded-[11px] py-[13px] px-[16px]">
          <div className="text-[14px] text-muted font-semibold flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-full inline-block bg-[#B9C2BD]"></span>Open POs</div>
          <div className="text-[35px] font-extrabold text-body mt-[2px] tracking-[-1px]">{openPOs.length}</div>
          <div className="text-[13px] text-muted mt-[1px]">Tracked end to end</div>
        </div>
        <div className="border border-line rounded-[11px] py-[13px] px-[16px]">
          <div className="text-[14px] text-muted font-semibold flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-full inline-block bg-bright"></span>On track</div>
          <div className="text-[35px] font-extrabold text-body mt-[2px] tracking-[-1px]">{onTrack.length}</div>
          <div className="text-[13px] text-muted mt-[1px]">Confirmed, no action</div>
        </div>
        <div className="border border-line rounded-[11px] py-[13px] px-[16px]">
          <div className="text-[14px] text-muted font-semibold flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-full inline-block bg-[#C7B273]"></span>Awaiting reply</div>
          <div className="text-[35px] font-extrabold text-body mt-[2px] tracking-[-1px]">{awaitingReply.length}</div>
          <div className="text-[13px] text-muted mt-[1px]">Chasing, within window</div>
        </div>
        <div className="border border-[#E6CFC9] bg-[#FDF7F6] rounded-[11px] py-[13px] px-[16px]">
          <div className="text-[14px] text-muted font-semibold flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-full inline-block bg-red"></span>Need attention</div>
          <div className="text-[35px] font-extrabold text-red mt-[2px] tracking-[-1px]">{needsAttention.length}</div>
          <div className="text-[13px] text-muted mt-[1px]">Need buyer&rsquo;s intervention</div>
        </div>
      </div>

      <div className="flex gap-1 pt-[14px] px-7 pb-0 border-b border-line">
        <button className={`text-[14.5px] font-bold text-muted pt-[10px] pb-[13px] px-[16px] border-b-[2.5px] border-transparent bg-none cursor-pointer flex items-center gap-2 hover:text-body ${activeTab === 'open' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('open')}>
          Open POs <span className={`text-[12.5px] font-bold text-muted bg-[#F0F3F1] rounded-[20px] py-[1px] px-[8px] ${activeTab === 'open' ? '!bg-pale !text-emerald' : ''}`}>{openPOs.length}</span>
        </button>
        <button className={`text-[14.5px] font-bold text-muted pt-[10px] pb-[13px] px-[16px] border-b-[2.5px] border-transparent bg-none cursor-pointer flex items-center gap-2 hover:text-body ${activeTab === 'attn' ? '!text-red !border-red' : ''}`} onClick={() => setActiveTab('attn')}>
          Needs attention <span className={`text-[12.5px] font-bold text-muted bg-[#F0F3F1] rounded-[20px] py-[1px] px-[8px] ${activeTab === 'attn' ? '!bg-redfill !text-red' : ''}`}>{needsAttention.length}</span>
        </button>
        <button className={`text-[14.5px] font-bold text-muted pt-[10px] pb-[13px] px-[16px] border-b-[2.5px] border-transparent bg-none cursor-pointer flex items-center gap-2 hover:text-body ${activeTab === 'track' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('track')}>
          On track <span className={`text-[12.5px] font-bold text-muted bg-[#F0F3F1] rounded-[20px] py-[1px] px-[8px] ${activeTab === 'track' ? '!bg-pale !text-emerald' : ''}`}>{onTrack.length}</span>
        </button>
        <button className={`text-[14.5px] font-bold text-muted pt-[10px] pb-[13px] px-[16px] border-b-[2.5px] border-transparent bg-none cursor-pointer flex items-center gap-2 hover:text-body ${activeTab === 'await' ? '!text-emerald !border-emerald' : ''}`} onClick={() => setActiveTab('await')}>
          Awaiting reply <span className={`text-[12.5px] font-bold text-muted bg-[#F0F3F1] rounded-[20px] py-[1px] px-[8px] ${activeTab === 'await' ? '!bg-pale !text-emerald' : ''}`}>{awaitingReply.length}</span>
        </button>
      </div>

      {/* ============ OPEN POs ============ */}
      <div className={`hidden ${activeTab === 'open' ? '!block' : ''}`} id="open">
        <div className="py-[18px] px-7 pb-[4px] flex items-baseline gap-[10px]">
          <h2 className="text-[18px] font-extrabold text-emerald">Open POs</h2>
          <span className="text-[14px] text-muted font-semibold">all {openPOs.length} open POs across every status</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">PO</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Supplier</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;code</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;description</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Quantity</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Need&nbsp;by</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Status</th>
              </tr>
            </thead>
            <tbody>
              {renderTableRows(openPOs, 'open')}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 px-7 pb-[18px] flex items-center justify-between flex-wrap gap-y-2.5">
          <div className="flex items-center gap-3.5"><span className="text-[14px] text-accent font-bold">{getShowingText(openPOs, 'open')}</span></div>
          <div className="flex items-center gap-1" id="pagerOpen">
            {renderReactPager('open', openPOs.length)}
          </div>
          <span className="text-[13px] text-muted flex items-center gap-[7px]"><span className="w-[7px] h-[7px] rounded-full bg-bright inline-block"></span>Live</span>
        </div>
      </div>

      {/* ============ NEEDS ATTENTION ============ */}
      <div className={`hidden ${activeTab === 'attn' ? '!block' : ''}`} id="attn">
        <div className="py-[18px] px-7 pb-[4px] flex items-baseline gap-[10px]">
          <h2 className="text-[18px] font-extrabold text-emerald">Needs attention today</h2>
          <span className="text-[14px] text-muted font-semibold">{needsAttention.length} of {openPOs.length} open POs</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">PO</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Supplier</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;code</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;description</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Quantity</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Need&nbsp;by</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Status</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">What&rsquo;s happening</th>
              </tr>
            </thead>
            <tbody>
              {renderTableRows(needsAttention, 'attn', true)}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 px-7 pb-[18px] flex items-center justify-between flex-wrap gap-y-2.5">
          <div className="flex items-center gap-3.5"><span className="text-[14px] text-accent font-bold">{getShowingText(needsAttention, 'attn')}</span></div>
          <div className="flex items-center gap-1" id="pagerAttn">
            {renderReactPager('attn', needsAttention.length)}
          </div>
          <span className="text-[13px] text-muted flex items-center gap-[7px]"><span className="w-[7px] h-[7px] rounded-full bg-bright inline-block"></span>Live</span>
        </div>
      </div>

      {/* ============ ON TRACK ============ */}
      <div className={`hidden ${activeTab === 'track' ? '!block' : ''}`} id="track">
        <div className="py-[18px] px-7 pb-[4px] flex items-baseline gap-[10px]">
          <h2 className="text-[18px] font-extrabold text-emerald">On track</h2>
          <span className="text-[14px] text-muted font-semibold">{onTrack.length} of {openPOs.length} open POs, confirmed, no action needed</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">PO</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Supplier</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;code</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;description</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Quantity</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Ship-by</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Status</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Delivery status</th>
              </tr>
            </thead>
            <tbody>
              {renderTableRows(onTrack, 'track', true)}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 px-7 pb-[18px] flex items-center justify-between flex-wrap gap-y-2.5">
          <div className="flex items-center gap-3.5"><span className="text-[14px] text-accent font-bold">{getShowingText(onTrack, 'track')}</span></div>
          <div className="flex items-center gap-1" id="pagerTrack">
            {renderReactPager('track', onTrack.length)}
          </div>
          <span className="text-[13px] text-muted flex items-center gap-[7px]"><span className="w-[7px] h-[7px] rounded-full bg-bright inline-block"></span>Live</span>
        </div>
      </div>

      {/* ============ AWAITING REPLY ============ */}
      <div className={`hidden ${activeTab === 'await' ? '!block' : ''}`} id="await">
        <div className="py-[18px] px-7 pb-[4px] flex items-baseline gap-[10px]">
          <h2 className="text-[18px] font-extrabold text-emerald">Awaiting reply</h2>
          <span className="text-[14px] text-muted font-semibold">{awaitingReply.length} of {openPOs.length} open POs, chasing, within window</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">PO</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Supplier</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;code</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Material&nbsp;description</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Quantity</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Need&nbsp;by</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Status</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Last update from supplier</th>
                <th className="text-[12.5px] uppercase tracking-[0.7px] text-muted font-bold text-left py-2.5 px-4 border-b border-line">Next touch point</th>
              </tr>
            </thead>
            <tbody>
              {renderTableRows(awaitingReply, 'await', true)}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 px-7 pb-[18px] flex items-center justify-between flex-wrap gap-y-2.5">
          <div className="flex items-center gap-3.5"><span className="text-[14px] text-accent font-bold">{getShowingText(awaitingReply, 'await')}</span></div>
          <div className="flex items-center gap-1" id="pagerAwait">
            {renderReactPager('await', awaitingReply.length)}
          </div>
          <span className="text-[13px] text-muted flex items-center gap-[7px]"><span className="w-[7px] h-[7px] rounded-full bg-bright inline-block"></span>Live</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
