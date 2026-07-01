import React from 'react';
import { useNavigate } from 'react-router-dom';

function SupplierPerformance() {
  const navigate = useNavigate();

  const suppliers = [
    { name: 'Green Elements', code: 'S20', desc: 'brushware', poLines: 96, onTime: 92, avgDaysLate: 0.8, avgRespTime: '0.9 d', escalated: '4%', flag: '', rateClass: 'good' },
    { name: 'Summit Foils', code: 'S14', desc: 'foils', poLines: 128, onTime: 88, avgDaysLate: 1.2, avgRespTime: '1.1 d', escalated: '6%', flag: '', rateClass: 'good' },
    { name: 'Pace Labels', code: 'S22', desc: 'labels', poLines: 148, onTime: 81, avgDaysLate: 1.9, avgRespTime: '1.4 d', escalated: '9%', flag: '', rateClass: 'mid' },
    { name: 'Apex Packaging', code: 'S09', desc: 'packaging', poLines: 204, onTime: 74, avgDaysLate: 2.8, avgRespTime: '1.9 d', escalated: '12%', flag: 'Review', rateClass: 'mid' },
    { name: 'Meridian Steel', code: 'S31', desc: 'metals', poLines: 87, onTime: 61, avgDaysLate: 4.4, avgRespTime: '2.6 d', escalated: '18%', flag: 'Watch', rateClass: 'bad' },
    { name: 'Gulf Chem', code: 'S17', desc: 'chemicals', poLines: 177, onTime: 54, avgDaysLate: 6.2, avgRespTime: '3.1 d', escalated: '21%', flag: 'Watch', rateClass: 'bad' }
  ];

  const handleSupplierClick = (code) => {
    // Navigate to supplier detail page
    navigate(`/supplier-detail/${code}`);
  };

  return (
    <div className="supplier-performance-page min-h-screen py-[30px] bg-[#EEF1EF] text-[#2C2C2A] font-sans">
      <style>{`
        .supplier-performance-page .app-container {
          width: 1360px;
          margin: 0 auto;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
            <div className="who">Dan Whitaker &middot; Senior Buyer</div>
            <div className="day">Trailing 6 months &middot; to 18 Jun 2026</div>
          </div>
        </header>

        <div className="kpis">
          <div className="kpi">
            <div className="lab">On-time rate</div>
            <div className="num">78%</div>
            <div className="delta up">&#9650; 6 pts vs prior 6 mo</div>
          </div>
          <div className="kpi">
            <div className="lab">Escalated to buyer</div>
            <div className="num">14%</div>
            <div className="delta down">&#9660; 3 pts vs prior 6 mo</div>
          </div>
          <div className="kpi">
            <div className="lab">PO lines tracked</div>
            <div className="num">9,840</div>
            <div className="delta flat">across 112 suppliers</div>
          </div>
        </div>

        <div className="chartwrap">
          <div className="card">
            <div className="ct">On-time delivery rate over time</div>
            <div className="cs">Share of PO lines delivered on or before the agreed date, by month, across all suppliers</div>
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
              <polyline fill="none" stroke="#1D9E75" stroke-width="3"
                points="120,127 264,117 408,120 552,107 696,100 840,93" />
              <polygon fill="#1D9E75" opacity="0.08"
                points="120,127 264,117 408,120 552,107 696,100 840,93 840,220 120,220" />
              <circle cx="120" cy="127" r="4" fill="#0E5C44" />
              <circle cx="264" cy="117" r="4" fill="#0E5C44" />
              <circle cx="408" cy="120" r="4" fill="#0E5C44" />
              <circle cx="552" cy="107" r="4" fill="#0E5C44" />
              <circle cx="696" cy="100" r="4" fill="#0E5C44" />
              <circle cx="840" cy="93" r="5" fill="#C79A2E" />
              <text className="axlab" x="108" y="236">Jan</text>
              <text className="axlab" x="252" y="236">Feb</text>
              <text className="axlab" x="396" y="236">Mar</text>
              <text className="axlab" x="540" y="236">Apr</text>
              <text className="axlab" x="684" y="236">May</text>
              <text className="axlab" x="828" y="236">Jun</text>
            </svg>
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
            {suppliers.map((sup, idx) => (
              <tr key={idx} className="click" onClick={() => handleSupplierClick(sup.code)}>
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

        <div className="seemore">Showing 6 of 112 suppliers &middot; click any supplier, or view all</div>

        <div className="section">
          <h2>Delay analysis</h2>
          <div className="sub">Root cause of every delayed PO line over the trailing 6 months, by where the delay originated</div>
        </div>

        <div className="delaywrap">
          <div className="card">
            <div className="splitsummary">Of all delays, <b className="sb">31% originated internally</b> (payment, approvals) and <b className="si">69% on the supplier side</b>.</div>
            <div className="reasons">
              <div className="rrow">
                <span className="rn"><span className="src src-int"></span>Payment / invoice hold</span>
                <span className="rb"><i className="int" style={{ width: '19%' }}></i></span>
                <span className="rv">19%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-int"></span>Awaiting revised PO or approval</span>
                <span className="rb"><i className="int" style={{ width: '12%' }}></i></span>
                <span className="rv">12%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Raw material shortage</span>
                <span className="rb"><i className="sup" style={{ width: '24%' }}></i></span>
                <span className="rv">24%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Production / capacity</span>
                <span className="rb"><i className="sup" style={{ width: '18%' }}></i></span>
                <span className="rv">18%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Price dispute</span>
                <span className="rb"><i className="sup" style={{ width: '12%' }}></i></span>
                <span className="rv">12%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Logistics / transit</span>
                <span className="rb"><i className="sup" style={{ width: '7%' }}></i></span>
                <span className="rv">7%</span>
              </div>
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
