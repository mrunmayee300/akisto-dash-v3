import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function SupplierDetail() {
  const navigate = useNavigate();
  const { supplierId } = useParams();

  // We can dynamically adjust the supplier name if needed, but Gulf Chem (S17) is the primary mock supplier as per the reference
  const supplierName = supplierId === 'S17' ? 'Gulf Chem' : (supplierId === 'S20' ? 'Green Elements' : (supplierId === 'S14' ? 'Summit Foils' : (supplierId === 'S22' ? 'Pace Labels' : (supplierId === 'S09' ? 'Apex Packaging' : (supplierId === 'S31' ? 'Meridian Steel' : 'Gulf Chem')))));
  const supplierCode = supplierId || 'S17';

  // Customized details based on selected supplier to make the pages connect relevantly
  const supplierData = {
    'S17': { name: 'Gulf Chem', onTime: '54%', daysLate: '6.2', respTime: '3.1 d', escalated: '21%', flag: 'Watch', cat: '177 PO lines over the trailing 6 months · primary contact on file', contact: 'Lokesh Reddy', email: 'lokesh@gulfchem.in', location: 'Mumbai, Maharashtra' },
    'S20': { name: 'Green Elements', onTime: '92%', daysLate: '0.8', respTime: '0.9 d', escalated: '4%', flag: '', cat: '96 PO lines over the trailing 6 months · primary contact on file', contact: 'Sarah Jenkins', email: 'sarah.j@greenelements.co.uk', location: 'London, UK' },
    'S14': { name: 'Summit Foils', onTime: '88%', daysLate: '1.2', respTime: '1.1 d', escalated: '6%', flag: '', cat: '128 PO lines over the trailing 6 months · primary contact on file', contact: 'Alex Dupont', email: 'alex@summitfoils.com', location: 'Paris, France' },
    'S22': { name: 'Pace Labels', onTime: '81%', daysLate: '1.9', respTime: '1.4 d', escalated: '9%', flag: '', cat: '148 PO lines over the trailing 6 months · primary contact on file', contact: 'Michael Chang', email: 'm.chang@pacelabels.com', location: 'Singapore' },
    'S09': { name: 'Apex Packaging', onTime: '74%', daysLate: '2.8', respTime: '1.9 d', escalated: '12%', flag: 'Review', cat: '204 PO lines over the trailing 6 months · primary contact on file', contact: 'Emily Watson', email: 'emily@apexpkg.com', location: 'Chicago, IL' },
    'S31': { name: 'Meridian Steel', onTime: '61%', daysLate: '4.4', respTime: '2.6 d', escalated: '18%', flag: 'Watch', cat: '87 PO lines over the trailing 6 months · primary contact on file', contact: 'Vikram Mehta', email: 'vikram@meridiansteel.in', location: 'Pune, Maharashtra' }
  };

  const currentData = supplierData[supplierCode] || supplierData['S17'];

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
              <div className="nm">{currentData.name} <span>&middot; {supplierCode}</span></div>
              <div className="cat">{currentData.cat}</div>
            </div>
            {currentData.flag && (
              <span className={`flag ${currentData.flag === 'Watch' ? 'f-watch' : 'f-review'}`}>
                {currentData.flag}
              </span>
            )}
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="lab">On-time rate</div>
            <div className={`num ${parseInt(currentData.onTime) < 70 ? 'bad' : ''}`}>{currentData.onTime}</div>
          </div>
          <div className="kpi">
            <div className="lab">Avg days late</div>
            <div className="num">{currentData.daysLate}</div>
          </div>
          <div className="kpi">
            <div className="lab">Avg response time</div>
            <div className="num">{currentData.respTime}</div>
          </div>
          <div className="kpi">
            <div className="lab">Escalated to buyer</div>
            <div className="num">{currentData.escalated}</div>
          </div>
        </div>

        <div className="chartwrap">
          <div className="card">
            <div className="ct">On-time rate over time</div>
            <div className="cs">This supplier's monthly on-time rate, trending down over the trailing 6 months</div>
            <svg viewBox="0 0 900 260" height="260" style={{ maxWidth: '760px', margin: '0 auto' }}>
              <text className="axlab" x="2" y="28">100%</text>
              <text className="axlab" x="8" y="92">75%</text>
              <text className="axlab" x="8" y="156">50%</text>
              <text className="axlab" x="8" y="220">25%</text>
              <polyline fill="none" stroke="#B23B2E" stroke-width="3" points="120,62 264,70 408,78 552,104 696,120 840,136" />
              <polygon fill="#B23B2E" opacity="0.07" points="120,62 264,70 408,78 552,104 696,120 840,136 840,232 120,232" />
              <circle cx="120" cy="62" r="4" fill="#8A6516" />
              <circle cx="264" cy="70" r="4" fill="#8A6516" />
              <circle cx="408" cy="78" r="4" fill="#8A6516" />
              <circle cx="552" cy="104" r="4" fill="#8A6516" />
              <circle cx="696" cy="120" r="4" fill="#8A6516" />
              <circle cx="840" cy="136" r="5" fill="#B23B2E" />
              <text className="axlab" x="108" y="252">Jan</text>
              <text className="axlab" x="252" y="252">Feb</text>
              <text className="axlab" x="396" y="252">Mar</text>
              <text className="axlab" x="540" y="252">Apr</text>
              <text className="axlab" x="684" y="252">May</text>
              <text className="axlab" x="828" y="252">Jun</text>
            </svg>
          </div>
        </div>

        <div className="section">
          <h2>Delay analysis</h2>
          <div className="sub">Root cause of this supplier's delayed PO lines, by where the delay originated</div>
        </div>
        <div className="chartwrap" style={{ paddingTop: '6px' }}>
          <div className="card flush">
            <div className="reasons">
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Raw material shortage</span>
                <span className="rb"><i className="sup" style={{ width: '41%' }}></i></span>
                <span className="rv">41%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Production / capacity</span>
                <span className="rb"><i className="sup" style={{ width: '29%' }}></i></span>
                <span className="rv">29%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-int"></span>Payment / invoice hold</span>
                <span className="rb"><i className="int" style={{ width: '18%' }}></i></span>
                <span className="rv">18%</span>
              </div>
              <div className="rrow">
                <span className="rn"><span className="src src-sup"></span>Logistics / transit</span>
                <span className="rb"><i className="sup" style={{ width: '12%' }}></i></span>
                <span className="rv">12%</span>
              </div>
            </div>
            <div className="legend2">
              <span><span className="sw" style={{ background: 'var(--gold)' }}></span>Internal</span>
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>Supplier</span>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>Supplier contact</h2>
          <div className="sub">Who to reach about this supplier</div>
        </div>
        <div className="contactwrap">
          <div className="cf"><span className="cl">Contact name</span><span className="cv">{currentData.contact}</span></div>
          <div className="cf">
            <span className="cl">Email</span>
            <span className="cv"><a href={`mailto:${currentData.email}`}>{currentData.email}</a></span>
          </div>
          <div className="cf"><span className="cl">Phone</span><span className="cv">&ndash;</span></div>
          <div className="cf"><span className="cl">Source location</span><span className="cv">{currentData.location}</span></div>
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
            <tr className="click">
              <td className="po">300519</td>
              <td>Citric acid &middot; CA-08</td>
              <td className="num">14 Jun</td>
              <td className="num">20 Jun</td>
              <td className="num">+6</td>
              <td><span className="pill p-delayed">Delayed</span></td>
            </tr>
            <tr className="click">
              <td className="po">300487</td>
              <td>Sodium citrate &middot; SC-11</td>
              <td className="num">2 Jun</td>
              <td className="num">2 Jun</td>
              <td className="num">0</td>
              <td><span className="pill p-ontime">On time</span></td>
            </tr>
            <tr className="click">
              <td className="po">300455</td>
              <td>Citric acid &middot; CA-08</td>
              <td className="num">24 May</td>
              <td className="num">29 May</td>
              <td className="num">+5</td>
              <td><span className="pill p-delayed">Delayed</span></td>
            </tr>
            <tr className="click">
              <td className="po">300401</td>
              <td>Sodium citrate &middot; SC-11</td>
              <td className="num">15 May</td>
              <td className="num">15 May</td>
              <td className="num">0</td>
              <td><span className="pill p-ontime">On time</span></td>
            </tr>
            <tr className="click">
              <td className="po">300388</td>
              <td>Citric acid &middot; CA-08</td>
              <td className="num">10 May</td>
              <td className="num">10 May</td>
              <td className="num">0</td>
              <td><span className="pill p-ontime">On time</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SupplierDetail;
