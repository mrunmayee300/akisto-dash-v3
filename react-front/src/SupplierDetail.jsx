import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function formatShortDate(value) {
  if (!value) return '--';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    return `${day} ${month}`;
  } catch (e) {
    return value;
  }
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

function SupplierDetail() {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await fetch(`${APPS_SCRIPT_URL}?action=supplierDetail&supplierCode=${encodeURIComponent(supplierId)}&sessionToken=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Failed to fetch supplier details');
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
      console.error('Supplier Detail API Error:', err);
      setError('Unable to load supplier details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF1EF] text-[#2C2C2A] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm font-bold text-muted">Loading supplier details...</p>
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

  const { supplierMeta = {}, kpis = {}, trendData = [], delaySummary = [], recentDeliveries = [] } = data;

  const isWatch = parseInt(kpis.onTimeRate || 0) < 60;
  const strokeColor = isWatch ? '#B23B2E' : '#0E5C44';
  const fillOpacityColor = isWatch ? '#B23B2E' : '#1D9E75';

  // SVG Trend Chart Spacing
  // X Coordinate = 120 + index * 144
  // Y Coordinate = 220 - ((OTR - 25) / 75) * 192 (Y=28 is 100%, Y=220 is 25%)
  const svgPoints = trendData.map((d, index) => {
    const x = 120 + index * 144;
    const rate = d.rate;
    const boundedRate = Math.max(25, Math.min(100, rate));
    const y = 220 - ((boundedRate - 25) / 75) * 192;
    return { x, y, month: formatMonthLabel(d.month) };
  });

  const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(' ');
  const polygonPoints = svgPoints.length > 0
    ? `${polylinePoints} ${svgPoints[svgPoints.length - 1].x},232 ${svgPoints[0].x},232`
    : '';

  return (
    <div className="supplier-detail-page min-h-screen py-[30px] bg-[#EEF1EF] text-[#2C2C2A] font-sans">
      <style>{`
        .supplier-detail-page .app-container {
          width: 1360px;
          margin: 0 auto;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .supplier-detail-page .back {
          padding: 14px 28px 0;
          font-size: 13px;
          color: var(--accent);
          font-weight: 700;
          cursor: pointer;
          display: inline-block;
        }
        .supplier-detail-page .back:hover {
          text-decoration: underline;
        }
        .supplier-detail-page .ph {
          padding: 14px 28px 20px;
          border-bottom: 1px solid var(--line);
        }
        .supplier-detail-page .ph .top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .supplier-detail-page .ph .nm {
          font-size: 21px;
          font-weight: 800;
          color: var(--emerald);
          letter-spacing: -0.3px;
        }
        .supplier-detail-page .ph .nm span {
          font-size: 14px;
          color: var(--muted);
          font-weight: 600;
        }
        .supplier-detail-page .ph .cat {
          font-size: 13px;
          color: var(--muted);
          margin-top: 3px;
        }
        .supplier-detail-page .flag {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .supplier-detail-page .f-watch {
          background: var(--redfill);
          color: var(--red);
        }
        .supplier-detail-page .f-review {
          background: var(--goldfill);
          color: var(--darkgold);
        }
        .supplier-detail-page .kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
          padding: 18px 28px 6px;
        }
        .supplier-detail-page .kpi {
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 13px 15px;
        }
        .supplier-detail-page .kpi .lab {
          font-size: 11.5px;
          color: var(--muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .supplier-detail-page .kpi .num {
          font-size: 28px;
          font-weight: 800;
          color: var(--body);
          margin-top: 3px;
          letter-spacing: -1px;
        }
        .supplier-detail-page .kpi .num.bad {
          color: var(--red);
        }
        .supplier-detail-page .chartwrap {
          padding: 14px 28px 8px;
        }
        .supplier-detail-page .card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 18px 20px;
        }
        .supplier-detail-page .card.flush {
          border: none;
          padding: 0;
        }
        .supplier-detail-page .card .ct {
          font-size: 14px;
          font-weight: 800;
          color: var(--body);
          margin-bottom: 2px;
        }
        .supplier-detail-page .card .cs {
          font-size: 12.5px;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .supplier-detail-page svg {
          display: block;
          width: 100%;
          overflow: visible;
        }
        .supplier-detail-page .axlab {
          font-size: 10.5px;
          fill: var(--muted);
        }
        .supplier-detail-page .gridline {
          stroke: #EEF1EF;
          stroke-width: 1;
        }
        .supplier-detail-page .section {
          padding: 20px 28px 4px;
        }
        .supplier-detail-page .section h2 {
          font-size: 16px;
          font-weight: 800;
          color: var(--emerald);
        }
        .supplier-detail-page .section .sub {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 2px;
        }
        .supplier-detail-page table {
          width: 100%;
          border-collapse: collapse;
        }
        .supplier-detail-page thead th {
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--muted);
          font-weight: 700;
          text-align: left;
          padding: 10px 28px;
          border-bottom: 1px solid var(--line);
        }
        .supplier-detail-page thead th.r {
          text-align: right;
        }
        .supplier-detail-page tbody td {
          padding: 12px 28px;
          border-bottom: 1px solid #F2F4F2;
          font-size: 13.5px;
          vertical-align: middle;
        }
        .supplier-detail-page tbody tr:last-child td {
          border-bottom: none;
        }
        .supplier-detail-page tbody tr.click {
          cursor: pointer;
        }
        .supplier-detail-page tbody tr.click:hover {
          background: #FAFBFA;
        }
        .supplier-detail-page .po {
          font-weight: 800;
          color: var(--emerald);
          white-space: nowrap;
        }
        .supplier-detail-page .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }
        .supplier-detail-page .pill {
          display: inline-block;
          font-size: 11.5px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .supplier-detail-page .p-ontime {
          background: var(--pale);
          color: var(--emerald);
        }
        .supplier-detail-page .p-delayed {
          background: var(--redfill);
          color: var(--red);
        }
        .supplier-detail-page .p-review {
          background: var(--purplefill);
          color: var(--purple);
        }
        .supplier-detail-page .reasons {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 6px;
        }
        .supplier-detail-page .rrow {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .supplier-detail-page .rrow .rn {
          font-size: 13px;
          color: var(--body);
          font-weight: 600;
          width: 210px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .supplier-detail-page .rrow .rn .src {
          width: 9px;
          height: 9px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .supplier-detail-page .src-sup {
          background: var(--accent);
        }
        .supplier-detail-page .src-int {
          background: var(--gold);
        }
        .supplier-detail-page .rrow .rb {
          flex: 1;
          height: 18px;
          background: #EEF1EF;
          border-radius: 5px;
          overflow: hidden;
        }
        .supplier-detail-page .rrow .rb i {
          display: block;
          height: 100%;
          border-radius: 5px;
        }
        .supplier-detail-page .rrow .rb i.sup {
          background: var(--accent);
        }
        .supplier-detail-page .rrow .rb i.int {
          background: var(--gold);
        }
        .supplier-detail-page .rrow .rv {
          font-size: 12.5px;
          font-weight: 800;
          color: var(--body);
          width: 34px;
          text-align: right;
        }
        .supplier-detail-page .legend2 {
          display: flex;
          gap: 18px;
          margin-top: 14px;
          font-size: 12px;
          color: var(--muted);
        }
        .supplier-detail-page .legend2 span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .supplier-detail-page .legend2 .sw {
          width: 11px;
          height: 11px;
          border-radius: 3px;
        }
        .supplier-detail-page .contactwrap {
          padding: 10px 28px 6px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px 28px;
        }
        .supplier-detail-page .cf {
          display: flex;
          flex-direction: column;
        }
        .supplier-detail-page .cl {
          font-size: 11px;
          color: var(--muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 3px;
        }
        .supplier-detail-page .cv {
          font-size: 14px;
          color: var(--body);
          font-weight: 600;
        }
        .supplier-detail-page .cv a {
          color: var(--body);
          text-decoration: none;
        }
        .supplier-detail-page .cv a:hover {
          color: var(--accent);
        }
      `}</style>

      <div className="app-container">
        <div className="back" onClick={() => navigate('/supplier-performance')}>
          &larr; Back to supplier performance
        </div>

        <div className="ph">
          <div className="top">
            <div>
              <div className="nm">{supplierMeta.name} <span>&middot; {supplierMeta.code}</span></div>
              <div className="cat">{supplierMeta.cat}</div>
            </div>
            {supplierMeta.flag && (
              <span className={`flag ${supplierMeta.flag === 'Watch' ? 'f-watch' : 'f-review'}`}>
                {supplierMeta.flag}
              </span>
            )}
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="lab">On-time rate</div>
            <div className={`num ${isWatch ? 'bad' : ''}`}>{kpis.onTimeRate}</div>
          </div>
          <div className="kpi">
            <div className="lab">Avg days late</div>
            <div className="num">{kpis.avgDaysLate}</div>
          </div>
          <div className="kpi">
            <div className="lab">Avg response time</div>
            <div className="num">{kpis.avgRespTime}</div>
          </div>
          <div className="kpi">
            <div className="lab">Escalated to buyer</div>
            <div className="num">{kpis.escalatedRate}</div>
          </div>
        </div>

        <div className="chartwrap">
          <div className="card">
            <div className="ct">On-time rate over time</div>
            <div className="cs">This supplier's monthly on-time rate over the trailing 6 months</div>
            {trendData.length > 0 ? (
              <svg viewBox="0 0 900 260" height="260" style={{ maxWidth: '760px', margin: '0 auto' }}>
                <text className="axlab" x="2" y="28">100%</text>
                <text className="axlab" x="8" y="92">75%</text>
                <text className="axlab" x="8" y="156">50%</text>
                <text className="axlab" x="8" y="220">25%</text>
                
                <polyline fill="none" stroke={strokeColor} strokeWidth="3" points={polylinePoints} />
                <polygon fill={fillOpacityColor} opacity="0.07" points={polygonPoints} />

                {svgPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r={idx === svgPoints.length - 1 ? 5 : 4} fill={idx === svgPoints.length - 1 ? strokeColor : '#8A6516'} />
                    <text className="axlab" x={pt.x - 12} y="252">{pt.month}</text>
                  </g>
                ))}
              </svg>
            ) : (
              <p className="text-sm text-muted text-center py-10">No historical trends available for this supplier.</p>
            )}
          </div>
        </div>

        <div className="section">
          <h2>Delay analysis</h2>
          <div className="sub">Root cause of this supplier's delayed PO lines, by where the delay originated</div>
        </div>
        <div className="chartwrap" style={{ paddingTop: '6px' }}>
          <div className="card flush">
            <div className="reasons">
              {delaySummary.length > 0 ? (
                delaySummary.map((d, index) => (
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
                ))
              ) : (
                <p className="text-sm text-muted py-2">No delays logged for this supplier.</p>
              )}
            </div>
            {delaySummary.length > 0 && (
              <div className="legend2">
                <span><span className="sw" style={{ background: 'var(--gold)' }}></span>Internal</span>
                <span><span className="sw" style={{ background: 'var(--accent)' }}></span>Supplier</span>
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <h2>Supplier contact</h2>
          <div className="sub">Who to reach about this supplier</div>
        </div>
        <div className="contactwrap">
          <div className="cf"><span className="cl">Contact name</span><span className="cv">{supplierMeta.contact}</span></div>
          <div className="cf">
            <span className="cl">Email</span>
            <span className="cv">
              {supplierMeta.email !== '--' ? (
                <a href={`mailto:${supplierMeta.email}`}>{supplierMeta.email}</a>
              ) : (
                '--'
              )}
            </span>
          </div>
          <div className="cf"><span className="cl">Phone</span><span className="cv">{supplierMeta.phone}</span></div>
          <div className="cf"><span className="cl">Source location</span><span className="cv">{supplierMeta.location}</span></div>
        </div>

        <div className="section">
          <h2>Recent deliveries</h2>
          <div className="sub">Most recent completed line items for this supplier. Click one to open its full trail</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>PO</th>
              <th>Material</th>
              <th className="r">Need by</th>
              <th className="r">Delivered</th>
              <th className="r">Days late</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {recentDeliveries.length > 0 ? (
              recentDeliveries.map((item, idx) => (
                <tr 
                  key={idx} 
                  className={item.commsGroupId ? 'click' : ''} 
                  onClick={() => item.commsGroupId && navigate(`/detail/${item.commsGroupId}`)}
                >
                  <td className="po">{item.po}</td>
                  <td>{item.materialName} {item.materialCode && <span className="text-muted font-normal">&middot; {item.materialCode}</span>}</td>
                  <td className="num">{formatShortDate(item.needBy)}</td>
                  <td className="num">{formatShortDate(item.delivered)}</td>
                  <td className="num">{item.daysLate > 0 ? `+${item.daysLate}` : item.daysLate}</td>
                  <td>
                    <span className={`pill ${item.outcome === 'On time' ? 'p-ontime' : 'p-delayed'}`}>
                      {item.outcome}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center text-muted py-6">No recent completed deliveries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SupplierDetail;
