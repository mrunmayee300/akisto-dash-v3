import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function formatCurrentDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [supplierPage, setSupplierPage] = useState(1);
  const SUPPLIER_PAGE_SIZE = 5;

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
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
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

  const { suppliers = [], kpis = {}, trendData = [], delaySummary = [] } = data;
  const totalSupplierPages = Math.ceil(suppliers.length / SUPPLIER_PAGE_SIZE);
  const displayedSuppliers = suppliers.slice((supplierPage - 1) * SUPPLIER_PAGE_SIZE, supplierPage * SUPPLIER_PAGE_SIZE);

  // Spacing and scaling for SVG Trend chart
  // X coordinates map to 6 months: index 0 to 5
  // YCoordinate = 220 - ((OTR - 40) / 60) * 200
  const svgPoints = trendData.map((d, index) => {
    const x = 120 + index * 144;
    const rate = d.rate;
    const y = 220 - ((rate - 40) / 60) * 200;
    return { x, y, month: formatMonthLabel(d.month), rate };
  });

  const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(' ');
  const polygonPoints = svgPoints.length > 0 
    ? `${polylinePoints} ${svgPoints[svgPoints.length - 1].x},220 ${svgPoints[0].x},220`
    : '';

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
          padding: 10px 28px;
          border-bottom: 1px solid var(--line);
        }
        .supplier-performance-page thead th.r {
          text-align: right;
        }
        .supplier-performance-page tbody td {
          padding: 13px 28px;
          border-bottom: 1px solid #F2F4F2;
          font-size: 14px;
          vertical-align: middle;
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
        }
        .supplier-performance-page .f-watch {
          background: var(--redfill);
          color: var(--red);
        }
        .supplier-performance-page .f-review {
          background: var(--goldfill);
          color: var(--darkgold);
        }
        .supplier-performance-page .seemore {
          padding: 13px 28px 4px;
          font-size: 13px;
          color: var(--accent);
          font-weight: 700;
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
          width: 210px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
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
            <div className="who">{userName && userRole ? `${userName} . ${userRole}` : userName || userEmail}</div>
            <div className="day">Trailing 6 months &middot; to {formatCurrentDate()}</div>
          </div>
        </header>

        <div className="kpis">
          <div className="kpi">
            <div className="lab">On-time rate</div>
            <div className="num">{kpis.onTimeRate}%</div>
            <div className="delta up">&#9650; vs prior 6 mo</div>
          </div>
          <div className="kpi">
            <div className="lab">Escalated to buyer</div>
            <div className="num">{kpis.escalatedRate}%</div>
            <div className="delta down">&#9660; vs prior 6 mo</div>
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
              <svg viewBox="0 0 900 240" preserveAspectRatio="none" height="240">
                <line className="gridline" x1="40" y1="20" x2="900" y2="20" />
                <line className="gridline" x1="40" y1="70" x2="900" y2="70" />
                <line className="gridline" x1="40" y1="120" x2="900" y2="120" />
                <line className="gridline" x1="40" y1="170" x2="900" y2="170" />
                <line className="gridline" x1="40" y1="220" x2="900" y2="220" />
                <text className="axlab" x="0" y="24">100%</text>
                <text className="axlab" x="6" y="74">85%</text>
                <text className="axlab" x="6" y="124">70%</text>
                <text className="axlab" x="6" y="174">55%</text>
                <text className="axlab" x="6" y="224">40%</text>

                <polyline fill="none" stroke="#1D9E75" strokeWidth="3" points={polylinePoints} />
                <polygon fill="#1D9E75" opacity="0.08" points={polygonPoints} />

                {svgPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r={idx === svgPoints.length - 1 ? 5 : 4} fill={idx === svgPoints.length - 1 ? '#C79A2E' : '#0E5C44'} />
                    <text className="axlab" x={pt.x - 12} y="236">{pt.month}</text>
                  </g>
                ))}
              </svg>
            ) : (
              <p className="text-sm text-muted text-center py-10">No historical trends available.</p>
            )}
          </div>
        </div>

        <div className="section">
          <h2>Supplier reliability</h2>
          <div className="sub">Ranked by on-time rate over the trailing 6 months, strongest first. Click a supplier for their full history.</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th className="r">PO lines ordered</th>
              <th className="r">On-time rate</th>
              <th className="r">Avg days late</th>
              <th className="r">Avg response time</th>
              <th className="r">Escalated</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {displayedSuppliers.map((sup, idx) => (
              <tr key={idx} className="click" onClick={() => navigate(`/supplier-detail/${sup.code}`)}>
                <td className="sup">
                  {sup.name} <span className="code">{sup.code} &middot; {sup.desc}</span>
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
                  {sup.flag && (
                    <span className={`flag ${sup.flag === 'Watch' ? 'f-watch' : 'f-review'}`}>
                      {sup.flag}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="seemore" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span>
            Showing {displayedSuppliers.length > 0 ? (supplierPage - 1) * SUPPLIER_PAGE_SIZE + 1 : 0}-{Math.min(supplierPage * SUPPLIER_PAGE_SIZE, suppliers.length)} of {suppliers.length} suppliers &middot; click any supplier
          </span>
          {totalSupplierPages > 1 && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} id="supplier-pager">
              <button 
                disabled={supplierPage <= 1} 
                onClick={() => setSupplierPage(p => Math.max(1, p - 1))}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '7px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  opacity: supplierPage <= 1 ? 0.4 : 1
                }}
                id="supplier-prev-btn"
              >
                &lt;
              </button>
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 'bold', margin: '0 8px' }}>
                Page {supplierPage} of {totalSupplierPages}
              </span>
              <button 
                disabled={supplierPage >= totalSupplierPages} 
                onClick={() => setSupplierPage(p => Math.min(totalSupplierPages, p + 1))}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '7px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  opacity: supplierPage >= totalSupplierPages ? 0.4 : 1
                }}
                id="supplier-next-btn"
              >
                &gt;
              </button>
            </div>
          )}
        </div>

        <div className="section">
          <h2>Delay analysis</h2>
          <div className="sub">Root cause of every delayed PO line over the trailing 6 months, by where the delay originated</div>
        </div>

        <div className="delaywrap">
          <div className="card">
            <div className="splitsummary">
              Of all delays, <b className="sb">{totalInternal}% originated internally</b> (payment, approvals) and <b className="si">{totalSupplier}% on the supplier side</b>.
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
              <span><span className="sw" style={{ background: 'var(--gold)' }}></span>Internal</span>
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>Supplier</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupplierPerformance;
