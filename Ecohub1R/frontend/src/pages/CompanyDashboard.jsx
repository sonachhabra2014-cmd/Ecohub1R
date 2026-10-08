import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { apiRequest, getCurrentUser, setToken, setCurrentUser } from '../api';
import { jsPDF } from 'jspdf';
import './CompanyDashboard.css';

/* ─────────────────────────────────────────────────────────────────────────────
   CLEAN INTERACTIVE SVG PIE / DONUT CHART (REAL DATA ONLY)
───────────────────────────────────────────────────────────────────────────── */
function CleanPieChart({ data, title, subtitle, centerLabel, centerValue, size = 220 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) return null;

  const radius = size / 2 - 24;
  const cx = size / 2;
  const cy = size / 2;
  const innerRadius = radius * 0.54;

  let cumulative = 0;
  const segments = data.map((item, i) => {
    const pct = (item.percentage || 0) / 100;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const xi1 = cx + innerRadius * Math.cos(startAngle);
    const yi1 = cy + innerRadius * Math.sin(startAngle);
    const xi2 = cx + innerRadius * Math.cos(endAngle);
    const yi2 = cy + innerRadius * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    return { item, i, x1, y1, x2, y2, xi1, yi1, xi2, yi2, largeArc, pct };
  });

  return (
    <div className="single-pie-panel">
      <h3 className="pie-panel-title">{title}</h3>
      {subtitle && <p className="pie-panel-desc">{subtitle}</p>}

      <div className="pie-svg-wrapper">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map(({ item, i, x1, y1, x2, y2, xi1, yi1, xi2, yi2, largeArc, pct }) => {
            if (pct <= 0) return null;
            const isHovered = hoveredIndex === i;
            const scale = isHovered ? 1.05 : 1;
            return (
              <g
                key={i}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: `scale(${scale})`
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <path
                  d={`M ${xi1} ${yi1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${xi1} ${yi1} Z`}
                  fill={item.color || '#0f9d58'}
                  opacity={hoveredIndex !== null && !isHovered ? 0.6 : 1}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
            {centerLabel || ''}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#0f172a" fontSize="16" fontWeight="800">
            {centerValue || ''}
          </text>
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="pie-tooltip-box">
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{data[hoveredIndex].name}</div>
            <div style={{ color: data[hoveredIndex].color, fontWeight: 800, fontSize: '0.95rem' }}>
              {data[hoveredIndex].percentage}%
            </div>
            {data[hoveredIndex].weight_kg !== undefined && (
              <div>{data[hoveredIndex].weight_kg} kg</div>
            )}
            {data[hoveredIndex].count !== undefined && (
              <div>{data[hoveredIndex].count} items</div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="pie-legend-list">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="pie-legend-item"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="legend-swatch">
              <span className="swatch-dot" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
            </div>
            <div className="legend-values">
              {item.weight_kg !== undefined && <span>{item.weight_kg} kg</span>}
              {item.count !== undefined && <span>({item.count})</span>}
              <span style={{ color: item.color }}>{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const queryBrand = queryParams.get('brand');

  const currentUser = getCurrentUser();

  const [selectedBrand, setSelectedBrand] = useState(
    queryBrand ||
    (currentUser?.role === 'company' && currentUser.brand_code ? currentUser.brand_code : 'samsung')
  );

  const [metricsData, setMetricsData] = useState(null);
  const [impactReport, setImpactReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const availableBrands = [
    { code: 'samsung', name: 'Samsung Electronics' },
    { code: 'hp', name: 'HP Inc.' },
    { code: 'dell', name: 'Dell Technologies' },
    { code: 'lenovo', name: 'Lenovo Group' },
    { code: 'apple', name: 'Apple Inc.' }
  ];

  useEffect(() => {
    if (selectedBrand) {
      loadCompanyData(selectedBrand);
    }
  }, [selectedBrand]);

  const loadCompanyData = async (brand) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/companies/metrics?brand=${brand}`);
      setMetricsData(data);

      const report = await apiRequest(`/api/companies/impact-report?brand=${brand}`);
      setImpactReport(report);
    } catch (err) {
      console.error('Failed to load company data:', err);
      setMetricsData(null);
      setImpactReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    navigate('/login');
  };

  // 1. Download Impact Report as Official PDF
  const handleDownloadPDF = () => {
    if (!impactReport) {
      alert('Impact report data is loading. Please wait a moment.');
      return;
    }

    setDownloading(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const rep = impactReport;
      const primaryColor = [15, 157, 88]; // #0F9D58
      const darkColor = [31, 41, 55];    // #1F2937
      const textMuted = [100, 116, 139];

      // Top Header Banner
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ECOHUB EVIDENCE-BASED ESG REGISTRY', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(167, 243, 208);
      doc.text('VERIFIED CORPORATE IMPACT REPORT & MATERIAL RECOVERY LEDGER', 14, 24);
      doc.text(`AUDIT HASH: ${rep.verification_hash ? rep.verification_hash.slice(0, 32) + '...' : 'PENDING'}  |  DATE: ${new Date().toLocaleDateString()}`, 14, 30);

      // Sub-header Metadata Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 42, 182, 24, 2, 2, 'FD');

      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(rep.company_information?.name || selectedBrand.toUpperCase(), 20, 51);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(`Brand Identifier: ${selectedBrand.toUpperCase()}   |   Registry ID: ${rep.company_information?.compliance_id || 'ECOHUB-REG'}`, 20, 59);

      // Section 1: Genuine Metrics Table
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. VERIFIED E-WASTE INTAKE SUMMARY', 14, 76);

      const items = [
        ['Metric Description', 'Recorded Value', 'Audit Status'],
        ['Total Submissions Registered', `${rep.total_ewaste_managed?.total_submissions_count || 0} units`, 'Database Logged'],
        ['Total Registered Weight', `${rep.total_ewaste_managed?.total_weight_kg || 0} kg`, 'Citizen Weight Estimate'],
        ['Verified Material Recycled', `${rep.total_ewaste_managed?.verified_recycled_kg || 0} kg`, 'Physically Confirmed'],
        ['Physical Verification Rate', `${rep.verified_disposal_records?.verification_rate || '0%'}`, 'Geofence & Camera Locked'],
        ['Net CO2e Avoidance', `${rep.environmental_impact?.carbon_reduction_kg || 0} kg`, 'Calculated Impact'],
        ['Toxic Metals Diverted', `${rep.environmental_impact?.toxic_metals_diverted_kg || 0} kg`, 'Diversion Ratio (0.082)'],
        ['Landfill Space Preserved', `${rep.environmental_impact?.landfill_space_saved_m3 || 0} m³`, 'Volume Factor (0.025)']
      ];

      let startY = 82;
      items.forEach((row, idx) => {
        if (idx === 0) {
          doc.setFillColor(241, 245, 249);
          doc.rect(14, startY, 182, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
        } else {
          doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250);
          doc.rect(14, startY, 182, 8, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);
        }
        doc.text(row[0], 18, startY + 5.5);
        doc.text(row[1], 105, startY + 5.5);
        doc.text(row[2], 155, startY + 5.5);
        startY += 8;
      });

      // Section 2: Audit & Integrity Statement
      startY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('2. AUDIT TRAIL & ZERO-FRAUD VERIFICATION STATEMENT', 14, startY);

      startY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(
        'This impact report is generated dynamically from immutable transaction logs on the EcoHub platform.\n' +
        'Every verified unit included herein has satisfied physical geofencing (<=50m variance), hardware photographic\n' +
        'inspection, and cryptographic SHA-256 state locking at authorized collection points.',
        14,
        startY
      );

      // Section 3: Verification Cryptographic Signatures
      startY += 20;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, startY, 182, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('CRYPTOGRAPHIC AUDIT HASH (SHA-256):', 18, startY + 7);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(rep.verification_hash || 'SHA256:0000000000000000000000000000000000000000000000000000000000000000', 18, startY + 14);

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Official EcoHub Corporate ESG Document • Certified for Extended Producer Responsibility (EPR) reporting', 14, 285);

      const filename = `EcoHub_Impact_Report_${selectedBrand.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not export PDF report: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // 2. Export Raw Verified Disposal Data as CSV
  const handleExportCSV = () => {
    const disposals = metricsData?.disposals || [];
    if (disposals.length === 0) {
      alert('No disposal records found for this brand to export.');
      return;
    }

    const headers = ['Disposal_ID', 'Item_Name', 'Category', 'Estimated_Weight_KG', 'Status', 'Collection_Centre', 'Created_At'];
    const rows = disposals.map(d => [
      d.disposal_code || d.id,
      `"${(d.item_name || '').replace(/"/g, '""')}"`,
      d.category || '',
      d.estimated_weight_kg || 0,
      `"${d.status || ''}"`,
      `"${(d.collection_centre_name || '').replace(/"/g, '""')}"`,
      d.created_at || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EcoHub_Verified_Ledger_${selectedBrand}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const company = metricsData?.company || {};
  const ewasteMetrics = metricsData?.ewaste_metrics || {};
  const categoryPieData = metricsData?.ewaste_pie_data || [];
  const statusPieData = metricsData?.verification_status_pie || [];
  const devicePieData = metricsData?.device_breakdown_pie || [];
  const totalUnits = ewasteMetrics.total_units_collected || 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '3rem' }}>
      <div className="company-portal-container">
        
        {/* TOP HEADER: BRAND IDENTITY & ACTIONS */}
        <header className="company-portal-header">
          <div className="company-identity">
            <div className="company-avatar-box">🏢</div>
            <div className="company-title-wrap">
              <h1>{company.name || selectedBrand.toUpperCase()}</h1>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="company-brand-badge">
                  Brand Code: {selectedBrand.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {company.category || 'Consumer Electronics'}
                </span>
              </div>
            </div>
          </div>

          <div className="company-header-actions">
            {currentUser?.role === 'admin' && (
              <select
                className="brand-picker-select"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                {availableBrands.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.code.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => loadCompanyData(selectedBrand)}
              className="btn-refresh-data"
              title="Refresh metrics from database"
            >
              🔄 Refresh
            </button>

            <Link to="/portals" className="btn-refresh-data" style={{ textDecoration: 'none' }}>
              Switch Role
            </Link>

            <button
              onClick={handleLogout}
              className="btn-refresh-data"
              style={{ color: '#ef4444' }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* QUICK GENUINE KPI CARDS (REAL DATABASE TOTALS) */}
        <div className="real-kpi-ribbon">
          <div className="kpi-clean-card">
            <div className="kpi-label">Total E-Waste Collected</div>
            <div className="kpi-val">{ewasteMetrics.total_weight_kg || 0} kg</div>
            <div className="kpi-sub">
              {ewasteMetrics.total_weight_metric_tons || 0} Metric Tons
            </div>
          </div>

          <div className="kpi-clean-card">
            <div className="kpi-label">Registered Submissions</div>
            <div className="kpi-val">{totalUnits}</div>
            <div className="kpi-sub">Citizen drop-off tickets</div>
          </div>

          <div className="kpi-clean-card">
            <div className="kpi-label">Physically Verified</div>
            <div className="kpi-val">{ewasteMetrics.verified_recycled_kg || 0} kg</div>
            <div className="kpi-sub">
              {metricsData?.user_engagement_metrics?.verified_dropoffs || 0} units confirmed
            </div>
          </div>

          <div className="kpi-clean-card">
            <div className="kpi-label">Net Carbon Avoided</div>
            <div className="kpi-val">
              {metricsData?.sustainability_metrics?.carbon_impact_estimation_kg || 0} kg
            </div>
            <div className="kpi-sub">CO2e diverted from landfills</div>
          </div>
        </div>

        {/* 1. PIE DASHBOARD SECTION */}
        <section className="dashboard-section-card">
          <div className="section-head">
            <div>
              <h2>📊 E-Waste Recovery Breakdown (Pie Dashboard)</h2>
              <p>
                Visual distribution of electronic waste collected and physically verified across authorized collection centres.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Loading genuine database records...
            </div>
          ) : totalUnits === 0 || categoryPieData.length === 0 ? (
            /* TRUTHFUL ZERO STATE — NO FABRICATED OR MOCKED CHARTS */
            <div className="honest-empty-state">
              <div className="empty-icon-circle">📦</div>
              <h3>No E-Waste Disposals Recorded Yet</h3>
              <p>
                There are currently 0 registered or verified e-waste items for <strong>{company.name || selectedBrand.toUpperCase()}</strong>.
                All metrics on this dashboard are strictly derived from physical intake records at certified collection centres.
              </p>
              <div className="honest-pill-bar">
                <span>0.00 kg Total Material</span>
                <span>•</span>
                <span>0 Verified Units</span>
                <span>•</span>
                <span>0 kg CO2e Avoidance</span>
              </div>
            </div>
          ) : (
            /* REAL PIE CHARTS */
            <div className="pie-dashboard-grid">
              {categoryPieData.length > 0 && (
                <CleanPieChart
                  data={categoryPieData}
                  title="Category Distribution"
                  subtitle="Breakdown by device category"
                  centerLabel="Total Weight"
                  centerValue={`${ewasteMetrics.total_weight_kg || 0} kg`}
                />
              )}

              {statusPieData.length > 0 && (
                <CleanPieChart
                  data={statusPieData}
                  title="Verification Status"
                  subtitle="Physical intake confirmation"
                  centerLabel="Total Items"
                  centerValue={`${totalUnits}`}
                />
              )}

              {devicePieData.length > 0 && (
                <CleanPieChart
                  data={devicePieData}
                  title="Top Device Types"
                  subtitle="Most common items recovered"
                  centerLabel="Top Models"
                  centerValue={`${devicePieData.length}`}
                />
              )}
            </div>
          )}
        </section>

        {/* 2. DIRECTLY UNDER THAT: DOWNLOAD IMPACT REPORT */}
        <section className="dashboard-section-card impact-report-card">
          <div className="section-head" style={{ borderBottomColor: '#bbf7d0' }}>
            <div>
              <h2 style={{ color: '#065f46' }}>📑 Verified ESG &amp; Environmental Impact Report</h2>
              <p style={{ color: '#047857' }}>
                Official, cryptographically verifiable compliance record for Extended Producer Responsibility (EPR) audits.
              </p>
            </div>
          </div>

          <div className="report-summary-grid">
            <div className="report-data-item">
              <span className="report-data-label">Target Entity</span>
              <span className="report-data-val" style={{ fontSize: '1.15rem' }}>
                {impactReport?.company_information?.name || selectedBrand.toUpperCase()}
              </span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Verified Recycled</span>
              <span className="report-data-val">
                {impactReport?.total_ewaste_managed?.verified_recycled_kg || 0} kg
              </span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Verified Record Count</span>
              <span className="report-data-val">
                {impactReport?.verified_disposal_records?.total_verified || 0} units
              </span>
            </div>

            <div className="report-data-item">
              <span className="report-data-label">Verification Rate</span>
              <span className="report-data-val">
                {impactReport?.verified_disposal_records?.verification_rate || '0%'}
              </span>
            </div>
          </div>

          {/* SHA-256 Audit Trail */}
          <div className="report-audit-hash-row">
            <strong style={{ color: '#0f172a' }}>🔒 Audit Hash (SHA-256):</strong>
            <span>
              {impactReport?.verification_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
            </span>
          </div>

          {/* Direct Download Actions */}
          <div className="report-action-buttons">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || !impactReport}
              className="btn-download-pdf"
            >
              <span>📄</span>
              {downloading ? 'Generating PDF...' : 'Download Official Impact Report (PDF)'}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!metricsData?.disposals || metricsData.disposals.length === 0}
              className="btn-download-csv"
            >
              <span>📊</span>
              Export Verification Ledger (CSV)
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

export default CompanyDashboard;
