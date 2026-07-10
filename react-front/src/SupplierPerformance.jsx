import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function formatCurrentDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' });
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  if (monthStr.includes('-')) {
    const parts = monthStr.split('-');
    const m = parseInt(parts[1], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m - 1] || monthStr;
  }
  return monthStr;
}

function SupplierPerformance() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [supplierPage, setSupplierPage] = useState(() => {
    const saved = sessionStorage.getItem('supplierPerformancePage');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('supplierPerformanceActiveTab') || 'overview';
  });
  const [sortBy, setSortBy] = useState(() => {
    return sessionStorage.getItem('supplierPerformanceSortBy') || 'rate_desc';
  });
  const [filterFlag, setFilterFlag] = useState(() => {
    return sessionStorage.getItem('supplierPerformanceFilterFlag') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('supplierPerformanceSearchQuery') || '';
  });

  const SUPPLIER_PAGE_SIZE = 15;

  const userEmail = localStorage.getItem('userEmail');
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  const loadData = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await fetch(`${APPS_SCRIPT_URL}?action=supplierPerformance&sessionToken=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Failed to fetch supplier performance data');
      const json = await response.json();

      if (json.success === false && json.error === 'Unauthorized') {
        localStorage.removeItem('sessionToken');
        navigate('/login');
        return;
      }

      if (json.success === false) {
        throw new Error(json.message || 'API returned success: false');
      }

      setData(json);
    } catch (err) {
      console.error('Supplier Performance API Error:', err);
      setError('Unable to load supplier performance metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('supplierPerformanceActiveTab', tab);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setSupplierPage(1);
    sessionStorage.setItem('supplierPerformanceSortBy', newSort);
    sessionStorage.setItem('supplierPerformancePage', '1');
  };

  const handleFlagChange = (newFlag) => {
    setFilterFlag(newFlag);
    setSupplierPage(1);
    sessionStorage.setItem('supplierPerformanceFilterFlag', newFlag);
    sessionStorage.setItem('supplierPerformancePage', '1');
  };

  const handleSearchChange = (newSearch) => {
    setSearchQuery(newSearch);
    setSupplierPage(1);
    sessionStorage.setItem('supplierPerformanceSearchQuery', newSearch);
    sessionStorage.setItem('supplierPerformancePage', '1');
  };

  const handlePageChange = (newPage) => {
    setSupplierPage(newPage);
    sessionStorage.setItem('supplierPerformancePage', String(newPage));
  };

  // Memoize filtered suppliers list to be reference stable on page change
  const filteredSuppliers = React.useMemo(() => {
    if (!data) return [];
    const suppliers = data.suppliers || [];
    return suppliers.filter(sup => {
      const matchesSearch = !searchQuery ||
        (sup.name && sup.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sup.code && String(sup.code).toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const mappedFlag = (sup.flag === 'Watch' || sup.flag === 'Action Needed') ? 'Action Needed'
        : ((sup.flag === 'Review' || sup.flag === 'Monitor') ? 'Monitor' : '');

      if (filterFlag === 'Action Needed') {
        return mappedFlag === 'Action Needed';
      } else if (filterFlag === 'Monitor') {
        return mappedFlag === 'Monitor';
      } else if (filterFlag === 'none') {
        return !mappedFlag;
      }
      return true;
    });
  }, [data, searchQuery, filterFlag]);

  // Memoize sorted suppliers list to prevent re-sorting on page navigation
  const sortedSuppliers = React.useMemo(() => {
    return [...filteredSuppliers]
      .map((sup, index) => ({ sup, index }))
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'rate_desc') {
          diff = (b.sup.onTime || 0) - (a.sup.onTime || 0);
        } else if (sortBy === 'rate_asc') {
          diff = (a.sup.onTime || 0) - (b.sup.onTime || 0);
        } else if (sortBy === 'lines_desc') {
          diff = (b.sup.poLines || 0) - (a.sup.poLines || 0);
        } else if (sortBy === 'late_desc') {
          diff = parseFloat(b.sup.avgDaysLate || 0) - parseFloat(a.sup.avgDaysLate || 0);
        } else if (sortBy === 'esc_desc') {
          const parseEsc = val => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace('%', '')) || 0;
            return 0;
          };
          diff = parseEsc(b.sup.escalated) - parseEsc(a.sup.escalated);
        }

        if (diff !== 0) return diff;

        // Stable tie-breaker: sort alphabetically by name
        const nameA = String(a.sup.name || '').trim();
        const nameB = String(b.sup.name || '').trim();
        const nameCompare = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;

        const codeA = String(a.sup.code || '').trim();
        const codeB = String(b.sup.code || '').trim();
        const codeCompare = codeA.localeCompare(codeB);
        if (codeCompare !== 0) return codeCompare;

        return a.index - b.index;
      })
      .map(item => item.sup);
  }, [filteredSuppliers, sortBy]);

  const { kpis = {}, trendData: rawTrendData = [], delaySummary: rawDelaySummary = [] } = data || {};

  const trendData = React.useMemo(() => {
    const actualTrendData = rawTrendData || [];
    if (actualTrendData.length === 0) return [];
    // Sort ascending by month string, then take only the last 6 months
    const sorted = [...actualTrendData].sort((a, b) => a.month < b.month ? -1 : a.month > b.month ? 1 : 0);
    return sorted.slice(-6);
  }, [rawTrendData]);

  const delaySummary = rawDelaySummary || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF1EF] text-[#2C2C2A] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm font-bold text-muted">Loading performance dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#EEF1EF] text-[#2C2C2A] flex items-center justify-center font-sans">
        <div className="bg-white border border-line p-8 rounded-xl shadow-md max-w-md text-center">
          <div className="text-red font-bold text-lg mb-2">Error</div>
          <p className="text-sm text-muted mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-emerald text-white px-4 py-2 rounded font-bold hover:bg-accent transition-all text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalSupplierPages = Math.ceil(sortedSuppliers.length / SUPPLIER_PAGE_SIZE);
  const displayedSuppliers = sortedSuppliers.slice((supplierPage - 1) * SUPPLIER_PAGE_SIZE, supplierPage * SUPPLIER_PAGE_SIZE);

  // Spacing and scaling for SVG Trend chart
  // viewBox: "0 0 900 260" — chart area is x:[50,890], y:[20,220]; labels at y=250
  // Y: 20=100%, 220=0% (full range 0-100 clamped)
  const SVG_W = 900, SVG_H = 260;
  const CHART_X1 = 50, CHART_X2 = 890;
  const CHART_Y_TOP = 20, CHART_Y_BOT = 220;
  const count = trendData.length;
  const stepX = count > 1 ? (CHART_X2 - CHART_X1) / (count - 1) : 0;
  const svgPoints = trendData.map((d, index) => {
    const x = count === 1
      ? (CHART_X1 + CHART_X2) / 2
      : CHART_X1 + index * stepX;
    const rate = Math.max(0, Math.min(100, d.rate ?? 0));
    const y = CHART_Y_BOT - (rate / 100) * (CHART_Y_BOT - CHART_Y_TOP);
    return { x, y, month: formatMonthLabel(d.month), rate };
  });

  const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(' ');
  const polygonPoints = svgPoints.length > 0
    ? `${polylinePoints} ${svgPoints[svgPoints.length - 1].x},${CHART_Y_BOT} ${svgPoints[0].x},${CHART_Y_BOT}`
    : '';
  // Y-axis labels: evenly spaced 0%→100% in 5 steps
  const yAxisTicks = [100, 80, 60, 40, 20, 0].map(pct => ({
    label: `${pct}%`,
    y: CHART_Y_BOT - (pct / 100) * (CHART_Y_BOT - CHART_Y_TOP),
  }));

  // Calculate sum of internal vs supplier delay percentages
  const totalInternal = delaySummary
    .filter(d => d.side === 'internal')
    .reduce((sum, d) => sum + d.percentage, 0);
  const totalSupplier = delaySummary
    .filter(d => d.side === 'supplier')
    .reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className="supplier-performance-page min-h-screen bg-white text-[#2C2C2A] font-sans mx-[96px]">
      <style>{`
        .supplier-performance-page .app-container {
          width: 100%;
          min-height: 100vh;
          background: #fff;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
        .supplier-performance-page header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 28px;
          border-bottom: 1px solid var(--line);
        }
        .supplier-performance-page .brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .supplier-performance-page .logo {
          font-size: 23px;
          font-weight: 800;
          color: var(--emerald);
          letter-spacing: -0.5px;
        }
        .supplier-performance-page .logo .dot {
          color: var(--gold);
        }
        .supplier-performance-page .plabel {
          font-size: 14.5px;
          color: var(--muted);
          font-weight: 600;
          border-left: 1px solid var(--line);
          padding-left: 13px;
        }
        .supplier-performance-page .meta {
          text-align: right;
        }
        .supplier-performance-page .meta .who {
          font-size: 15px;
          font-weight: 700;
          color: var(--body);
        }
        .supplier-performance-page .meta .day {
          font-size: 13px;
          color: var(--muted);
          margin-top: 2px;
        }
        .supplier-performance-page .tabbar {
          display: flex;
          gap: 30px;
          padding: 0 28px;
          border-bottom: 1px solid var(--line);
          background: #fff;
        }
        .supplier-performance-page .tabbtn {
          padding: 16px 2px;
          font-size: 16px;
          font-weight: 700;
          color: var(--muted);
          cursor: pointer;
          background: none;
          border: none;
          border-bottom: 2.5px solid transparent;
          font-family: inherit;
          margin-bottom: -1px;
        }
        .supplier-performance-page .tabbtn:hover {
          color: var(--body);
        }
        .supplier-performance-page .tabbtn.active {
          color: var(--emerald);
          border-bottom-color: var(--emerald);
        }
        .supplier-performance-page .tabpane {
          display: none;
          padding: 26px 0 8px;
        }
        .supplier-performance-page .tabpane.show {
          display: block;
        }
        .supplier-performance-page .section {
          padding: 22px 28px 6px;
        }
        .supplier-performance-page .section h2 {
          font-size: 16px;
          font-weight: 800;
          color: var(--emerald);
        }
        .supplier-performance-page .section .sub {
          font-size: 13px;
          color: var(--muted);
          margin-top: 2px;
        }
        .supplier-performance-page .kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 13px;
          padding: 16px 28px 6px;
        }
        .supplier-performance-page .kpi {
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 14px 16px;
        }
        .supplier-performance-page .kpi .lab {
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .supplier-performance-page .kpi .num {
          font-size: 31px;
          font-weight: 800;
          color: var(--body);
          margin-top: 4px;
          letter-spacing: -1px;
        }
        .supplier-performance-page .kpi .delta {
          font-size: 12.5px;
          font-weight: 700;
          margin-top: 2px;
        }
        .supplier-performance-page .kpi .delta.up {
          color: var(--accent);
        }
        .supplier-performance-page .kpi .delta.down {
          color: var(--red);
        }
        .supplier-performance-page .kpi .delta.flat {
          color: var(--muted);
        }
        .supplier-performance-page .chartwrap {
          padding: 8px 28px 12px;
        }
        .supplier-performance-page .card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 18px 20px;
        }
        .supplier-performance-page .card .ct {
          font-size: 14px;
          font-weight: 800;
          color: var(--body);
          margin-bottom: 2px;
        }
        .supplier-performance-page .card .cs {
          font-size: 12.5px;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .supplier-performance-page svg {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .supplier-performance-page .axlab {
          font-size: 10.5px;
          fill: var(--muted);
        }
        .supplier-performance-page .gridline {
          stroke: #EEF1EF;
          stroke-width: 1;
        }
        .supplier-performance-page .controls {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 28px 4px;
          flex-wrap: wrap;
        }
        .supplier-performance-page .ctl {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .supplier-performance-page .ctl label {
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 700;
        }
        .supplier-performance-page .ctl select, .supplier-performance-page .ctl input {
          font-family: inherit;
          font-size: 13.5px;
          padding: 7px 11px;
          border: 1px solid var(--line);
          border-radius: 8px;
          color: var(--body);
          background: #fff;
          outline: none;
        }
        .supplier-performance-page .ctl select:focus, .supplier-performance-page .ctl input:focus {
          border-color: var(--accent);
        }
        .supplier-performance-page .ctl input {
          width: 210px;
        }
        .supplier-performance-page .spacer {
          flex: 1;
        }
        .supplier-performance-page .resultcount {
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 600;
        }
        .supplier-performance-page table {
          width: 100%;
          border-collapse: collapse;
        }
        .supplier-performance-page thead th {
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--muted);
          font-weight: 700;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
          user-select: none;
        }
        .supplier-performance-page thead th:first-child {
          padding-left: 28px;
        }
        .supplier-performance-page thead th:last-child {
          padding-right: 28px;
        }
        .supplier-performance-page thead th.r {
          text-align: right;
        }
        .supplier-performance-page tbody td {
          padding: 13px 12px;
          border-bottom: 1px solid #F2F4F2;
          font-size: 14px;
          vertical-align: middle;
        }
        .supplier-performance-page tbody td:first-child {
          padding-left: 28px;
        }
        .supplier-performance-page tbody td:last-child {
          padding-right: 28px;
        }
        .supplier-performance-page tbody tr:last-child td {
          border-bottom: none;
        }
        .supplier-performance-page tbody tr.click {
          cursor: pointer;
        }
        .supplier-performance-page tbody tr.click:hover {
          background: #FAFBFA;
        }
        .supplier-performance-page .sup {
          font-weight: 700;
          color: var(--body);
        }
        .supplier-performance-page .sup .code {
          color: var(--muted);
          font-weight: 600;
          font-size: 12.5px;
        }
        .supplier-performance-page .num {
          text-align: right;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .supplier-performance-page .rate {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }
        .supplier-performance-page .ratebar {
          width: 54px;
          height: 7px;
          border-radius: 4px;
          background: #EEF1EF;
          overflow: hidden;
        }
        .supplier-performance-page .ratebar i {
          display: block;
          height: 100%;
          border-radius: 4px;
        }
        .supplier-performance-page .rate.good i {
          background: var(--bright);
        }
        .supplier-performance-page .rate.mid i {
          background: var(--gold);
        }
        .supplier-performance-page .rate.bad i {
          background: var(--red);
        }
        .supplier-performance-page .rate .pct {
          min-width: 38px;
          text-align: right;
        }
        .supplier-performance-page .flag {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }
        .supplier-performance-page .f-action {
          background: var(--redfill);
          color: var(--red);
        }
        .supplier-performance-page .f-monitor {
          background: var(--goldfill);
          color: var(--darkgold);
        }
        .supplier-performance-page .pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 28px 6px;
        }
        .supplier-performance-page .pginfo {
          font-size: 14px;
          color: var(--emerald);
          font-weight: 700;
        }
        .supplier-performance-page .pgbtns {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .supplier-performance-page .pgbtns button {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #fff;
          font-weight: 700;
          color: var(--muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .supplier-performance-page .pgbtns button:hover:not(:disabled) {
          background: #FAFBFA;
          color: var(--body);
        }
        .supplier-performance-page .pgbtns button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .supplier-performance-page .pgbtns .cur {
          font-size: 14px;
          font-weight: 700;
          color: var(--body);
        }
        .supplier-performance-page .delaywrap {
          padding: 8px 28px 18px;
        }
        .supplier-performance-page .delaywrap .card {
          border: none;
          border-radius: 0;
          padding: 0;
        }
        .supplier-performance-page .splitsummary {
          font-size: 13px;
          color: var(--body);
          font-weight: 600;
          margin-bottom: 14px;
        }
        .supplier-performance-page .splitsummary b {
          font-weight: 800;
        }
        .supplier-performance-page .splitsummary .si {
          color: var(--accent);
        }
        .supplier-performance-page .splitsummary .sb {
          color: var(--darkgold);
        }
        .supplier-performance-page .reasons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .supplier-performance-page .rrow {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .supplier-performance-page .rrow .rn {
          font-size: 13px;
          color: var(--body);
          font-weight: 600;
          width: 280px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .supplier-performance-page .rrow .rn .src {
          width: 9px;
          height: 9px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .supplier-performance-page .src-sup {
          background: var(--accent);
        }
        .supplier-performance-page .src-int {
          background: var(--gold);
        }
        .supplier-performance-page .rrow .rb {
          flex: 1;
          height: 20px;
          background: #EEF1EF;
          border-radius: 5px;
          overflow: hidden;
        }
        .supplier-performance-page .rrow .rb i {
          display: block;
          height: 100%;
          border-radius: 5px;
        }
        .supplier-performance-page .rrow .rb i.sup {
          background: var(--accent);
        }
        .supplier-performance-page .rrow .rb i.int {
          background: var(--gold);
        }
        .supplier-performance-page .rrow .rv {
          font-size: 12.5px;
          font-weight: 800;
          color: var(--body);
          width: 34px;
          text-align: right;
        }
        .supplier-performance-page .legend2 {
          display: flex;
          gap: 18px;
          margin-top: 16px;
          margin-bottom: 16px;
          font-size: 12px;
          color: var(--muted);
        }
        .supplier-performance-page .legend2 span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .supplier-performance-page .legend2 .sw {
          width: 11px;
          height: 11px;
          border-radius: 3px;
        }
      `}</style>

      <div className="app-container">
        <header>
          <div className="brand">
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                padding: '4px 10px',
                borderRadius: '6px',
                marginRight: '8px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              &larr; Dashboard
            </button>
            <span className="logo">akisto<span className="dot">.</span></span>
            <span className="plabel">Supplier performance</span>
          </div>
          <div className="meta">
            <div className="who">{userName && userRole ? `${userName} · ${userRole}` : userName || userEmail}</div>
            <div className="day">Trailing 6 months &middot; as of {formatCurrentDate()}</div>
          </div>
        </header>

        <div className="tabbar">
          <button className={`tabbtn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>Overview</button>
          <button className={`tabbtn ${activeTab === 'bysupplier' ? 'active' : ''}`} onClick={() => handleTabChange('bysupplier')}>By supplier</button>
        </div>

        {/* ============ TAB 1: OVERVIEW ============ */}
        <div className={`tabpane ${activeTab === 'overview' ? 'show' : ''}`} id="overview">
          <div className="kpis">
            <div className="kpi">
              <div className="lab">On-time rate</div>
              <div className="num">{kpis.onTimeRate}%</div>
              {kpis.onTimeRateDelta > 0 && (
                <div className="delta up">&#9650; {Math.round(Math.abs(kpis.onTimeRateDelta) * 100)}% vs prior 6 mo</div>
              )}
              {kpis.onTimeRateDelta < 0 && (
                <div className="delta down">&#9660; {Math.round(Math.abs(kpis.onTimeRateDelta) * 100)}% vs prior 6 mo</div>
              )}
              {(kpis.onTimeRateDelta === 0 || kpis.onTimeRateDelta === undefined) && (
                <div className="delta flat">Flat vs prior 6 mo</div>
              )}
            </div>
            <div className="kpi">
              <div className="lab">Escalated to buyer</div>
              <div className="num">{kpis.escalatedRate}%</div>
              {kpis.escalatedRateDelta > 0 && (
                <div className="delta down">&#9650; {Math.round(Math.abs(kpis.escalatedRateDelta) * 100)}% vs prior 6 mo</div>
              )}
              {kpis.escalatedRateDelta < 0 && (
                <div className="delta up">&#9660; {Math.round(Math.abs(kpis.escalatedRateDelta) * 100)}% vs prior 6 mo</div>
              )}
              {(kpis.escalatedRateDelta === 0 || kpis.escalatedRateDelta === undefined) && (
                <div className="delta flat">Flat vs prior 6 mo</div>
              )}
            </div>
            <div className="kpi">
              <div className="lab">PO lines tracked</div>
              <div className="num">{kpis.totalPoLines?.toLocaleString() || '0'}</div>
              <div className="delta flat">across {kpis.supplierCount} suppliers</div>
            </div>
          </div>

          <div className="chartwrap">
            <div className="card">
              <div className="ct">On-time delivery rate over time</div>
              <div className="cs">Share of PO lines delivered on or before the agreed date, by month, across all suppliers</div>
              {trendData.length > 0 ? (
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ display: 'block' }}>
                  <defs>
                    <clipPath id="chart-area-perf">
                      <rect x={CHART_X1} y={CHART_Y_TOP - 5} width={CHART_X2 - CHART_X1} height={CHART_Y_BOT - CHART_Y_TOP + 10} />
                    </clipPath>
                  </defs>

                  {/* Gridlines + Y-axis labels */}
                  {yAxisTicks.map((tick, i) => (
                    <g key={i}>
                      <line className="gridline" x1={CHART_X1} y1={tick.y} x2={CHART_X2} y2={tick.y} />
                      <text className="axlab" x={CHART_X1 - 6} y={tick.y + 4} textAnchor="end">{tick.label}</text>
                    </g>
                  ))}

                  {/* Area fill + line — clipped */}
                  <g clipPath="url(#chart-area-perf)">
                    <polygon fill="#1D9E75" opacity="0.08" points={polygonPoints} />
                    <polyline fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={polylinePoints} />
                  </g>

                  {/* Data points + X-axis month labels */}
                  {svgPoints.map((pt, idx) => (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={Math.max(CHART_Y_TOP, Math.min(CHART_Y_BOT, pt.y))}
                        r={idx === svgPoints.length - 1 ? 5 : 4}
                        fill='#0E5C44'
                      />
                      <text className="axlab" x={pt.x} y={CHART_Y_BOT + 22} textAnchor="middle">{pt.month}</text>
                    </g>
                  ))}
                </svg>
              ) : (
                <p className="text-sm text-muted text-center py-10">No historical trends available.</p>
              )}
            </div>
          </div>

          <div className="section">
            <h2>Delay analysis</h2>
            <div className="sub">Root cause of every delayed PO line over the trailing 6 months, by where the delay originated</div>
          </div>

          <div className="delaywrap">
            <div className="card">
              <div className="splitsummary">
                Of all delays, <b className="sb">{totalInternal}% were internal blockers</b> and <b className="si">{totalSupplier}% were supplier-side issues</b>.
              </div>
              <div className="reasons">
                {delaySummary.map((d, index) => (
                  <div key={index} className="rrow">
                    <span className="rn">
                      <span className={`src ${d.side === 'internal' ? 'src-int' : 'src-sup'}`}></span>
                      {d.category}
                    </span>
                    <span className="rb">
                      <i className={d.side === 'internal' ? 'int' : 'sup'} style={{ width: `${d.percentage}%` }}></i>
                    </span>
                    <span className="rv">{d.percentage}%</span>
                  </div>
                ))}
              </div>
              <div className="legend2">
                <span><span className="sw" style={{ background: 'var(--gold)' }}></span>Internal blockers</span>
                <span><span className="sw" style={{ background: 'var(--accent)' }}></span>Supplier-side issues</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============ TAB 2: BY SUPPLIER ============ */}
        <div className={`tabpane ${activeTab === 'bysupplier' ? 'show' : ''}`} id="bysupplier">
          <div className="section">
            <h2>Supplier reliability</h2>
            <div className="sub">Every supplier ranked on delivery performance over the trailing 6 months. Sort, filter, or search to find who you need. Click a supplier for their full history.</div>
          </div>

          <div className="controls">
            <div className="ctl">
              <label htmlFor="sortSel">Sort</label>
              <select id="sortSel" value={sortBy} onChange={(e) => handleSortChange(e.target.value)}>
                <option value="rate_desc">On-time rate (best first)</option>
                <option value="rate_asc">On-time rate (worst first)</option>
                <option value="lines_desc">PO lines (highest first)</option>
                <option value="late_desc">Average days late (highest first)</option>
                <option value="esc_desc">Escalated % (highest first)</option>
              </select>
            </div>
            <div className="ctl">
              <label htmlFor="flagSel">Flag</label>
              <select id="flagSel" value={filterFlag} onChange={(e) => handleFlagChange(e.target.value)}>
                <option value="all">All suppliers</option>
                <option value="Action Needed">Action needed</option>
                <option value="Monitor">Monitor</option>
                <option value="none">Unflagged</option>
              </select>
            </div>
            <div className="ctl">
              <label htmlFor="searchBox">Search</label>
              <input
                id="searchBox"
                type="text"
                placeholder="Supplier name or code"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="spacer"></div>
            <div className="resultcount">
              {filteredSuppliers.length} supplier{filteredSuppliers.length === 1 ? '' : 's'} match
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th onClick={() => handleSortChange(sortBy === 'rate_desc' ? 'rate_asc' : 'rate_desc')} style={{ cursor: 'pointer' }}>Supplier</th>
                <th className="r" onClick={() => handleSortChange('lines_desc')} style={{ cursor: 'pointer' }}>PO lines ordered</th>
                <th className="r" onClick={() => handleSortChange(sortBy === 'rate_desc' ? 'rate_asc' : 'rate_desc')} style={{ cursor: 'pointer' }}>On-time rate</th>
                <th className="r" onClick={() => handleSortChange('late_desc')} style={{ cursor: 'pointer' }}>Avg days late</th>
                <th className="r">Avg response time</th>
                <th className="r" onClick={() => handleSortChange('esc_desc')} style={{ cursor: 'pointer' }}>Escalated</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {displayedSuppliers.map((sup, idx) => (
                <tr key={idx} className="click" onClick={() => navigate(`/supplier-detail/${sup.code}`)}>
                  <td className="sup">
                    {sup.name} <span className="code">{sup.code}</span>
                  </td>
                  <td className="num">{sup.poLines}</td>
                  <td>
                    <span className={`rate ${sup.rateClass}`}>
                      <span className="ratebar">
                        <i style={{ width: `${sup.onTime}%` }}></i>
                      </span>
                      <span className="pct">{sup.onTime}%</span>
                    </span>
                  </td>
                  <td className="num">{sup.avgDaysLate}</td>
                  <td className="num">{sup.avgRespTime}</td>
                  <td className="num">{sup.escalated}</td>
                  <td>
                    {(sup.flag === 'Watch' || sup.flag === 'Action Needed') && (
                      <span className="flag f-action">Action Needed</span>
                    )}
                    {(sup.flag === 'Review' || sup.flag === 'Monitor') && (
                      <span className="flag f-monitor">Monitor</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedSuppliers.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-10 font-semibold">No suppliers found matching the criteria.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pager">
            <div className="pginfo">
              Showing {displayedSuppliers.length > 0 ? (supplierPage - 1) * SUPPLIER_PAGE_SIZE + 1 : 0}–{Math.min(supplierPage * SUPPLIER_PAGE_SIZE, sortedSuppliers.length)} of {sortedSuppliers.length} suppliers
            </div>
            {totalSupplierPages > 1 && (
              <div className="pgbtns" id="supplier-pager">
                <button
                  disabled={supplierPage <= 1}
                  onClick={() => handlePageChange(Math.max(1, supplierPage - 1))}
                  id="supplier-prev-btn"
                >
                  &lt;
                </button>
                <span className="cur" id="pgcur">
                  Page {supplierPage} of {totalSupplierPages}
                </span>
                <button
                  disabled={supplierPage >= totalSupplierPages}
                  onClick={() => handlePageChange(Math.min(totalSupplierPages, supplierPage + 1))}
                  id="supplier-next-btn"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupplierPerformance;
