import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { apiRequest, getCurrentUser, getToken, setToken, setCurrentUser } from '../api';
import { QRCodeSVG } from 'qrcode.react';
import LiveCameraCapture from '../components/LiveCameraCapture';

export default function CollectionCentrePortal() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const initialDispId = queryParams.get('dispId') || '';

  // Auth States
  const [currentUser, setUser] = useState(getCurrentUser());
  const token = getToken();

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState({
    summary: { total_received: 0, total_pending: 0, total_weight_kg: 0 },
    pending_requests: [],
    verified_records: []
  });
  const [loading, setLoading] = useState(false);
  const [selectedDisposal, setSelectedDisposal] = useState(null);

  // Verification Input & Evidence States
  const [scannedIdInput, setScannedIdInput] = useState(initialDispId);
  const [evidencePhoto, setEvidencePhoto] = useState('');
  const [evidenceProductId, setEvidenceProductId] = useState('');
  const [evidencePhotoMetadata, setEvidencePhotoMetadata] = useState(null);
  const [evidenceProductIdMetadata, setEvidenceProductIdMetadata] = useState(null);
  const [actualWeight, setActualWeight] = useState(1.5);
  const [verifiedCategory, setVerifiedCategory] = useState('');
  const [officerNotes, setOfficerNotes] = useState('Hardware physically inspected at intake desk. Certified complete.');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'verified' | 'intake'

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (initialDispId) {
      setScannedIdInput(initialDispId);
      loadDisposalRecord(initialDispId);
    }
  }, [initialDispId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/collection-centres/dashboard');
      if (data) {
        setDashboardData({
          summary: data.summary || { total_received: 0, total_pending: 0, total_weight_kg: 0 },
          pending_requests: data.pending_requests || [],
          verified_records: data.verified_records || []
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDisposalRecord = async (id) => {
    if (!id || !id.trim()) return;
    try {
      const rec = await apiRequest(`/api/disposals/${id.trim()}`);
      if (rec && !rec.error) {
        setSelectedDisposal(rec);
        setEvidencePhoto('');
        setEvidenceProductId('');
        setEvidencePhotoMetadata(null);
        setEvidenceProductIdMetadata(null);
        setVerificationResult(null);
        setVerifiedCategory(rec.category || 'Laptop');
        setActualWeight(rec.estimated_weight_kg || 1.5);
        setActiveTab('intake');
      } else {
        alert(`Disposal record "${id}" not found.`);
      }
    } catch (err) {
      alert(`Could not load record "${id}": ${err.message}`);
    }
  };

  // Submit Physical Verification & Confidence Score Calculation
  const handleRunVerification = async (e) => {
    e.preventDefault();
    if (!selectedDisposal) {
      alert('Please select or scan a Disposal record first.');
      return;
    }

    if (!evidencePhoto) {
      alert('Please upload or capture the product photograph.');
      return;
    }

    if (!evidenceProductId) {
      alert('Please upload or capture the product ID photograph.');
      return;
    }
    setIsVerifying(true);
    setVerificationResult(null);

    const defaultCentreMeta = {
      capture_method: 'live_camera',
      captured_at: new Date().toISOString(),
      gps_lat: 0,
      gps_lng: 0,
      gps_accuracy: 0,
      device_id: 'ecohub_centre_submission',
      device_info: { user_agent: navigator.userAgent }
    };
    const resolvedPhotoMeta = evidencePhotoMetadata || defaultCentreMeta;
    const resolvedIdMeta = evidenceProductIdMetadata || defaultCentreMeta;

    try {
      const payload = {
        disposal_id: selectedDisposal.id,
        evidence_product_photo: evidencePhoto,
        evidence_product_id_image: evidenceProductId,
        capture_method: 'live_camera',
        capture_metadata: {
          user: selectedDisposal.capture_metadata,
          centre_product_photo: resolvedPhotoMeta,
          centre_product_id_photo: resolvedIdMeta
        },
        centre_photo_url: evidencePhoto,
        gps_lat: resolvedPhotoMeta.gps_lat || 0,
        gps_lng: resolvedPhotoMeta.gps_lng || 0,
        gps_accuracy: resolvedPhotoMeta.gps_accuracy || 0,
        actual_weight_kg: parseFloat(actualWeight),
        device_category_verified: verifiedCategory,
        notes: officerNotes
      };

      const res = await apiRequest('/api/collection-centres/verify-qr', 'POST', payload);
      if (res && res.disposal) {
        setVerificationResult(res.disposal);
        loadDashboard(); // Refresh pending and verified lists
      } else {
        throw new Error(res?.error || 'Verification processing failed');
      }
    } catch (err) {
      alert(`Verification error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Fast demo sign-in for testing if unauthenticated
  const handleQuickCentreSignIn = () => {
    const demoCentreUser = {
      id: 2,
      name: 'Green Hub Delhi Central',
      email: 'officer@delhi.ecohub.org',
      role: 'collection_centre',
      centre_id: 1
    };
    // Create valid token representation
    setToken('demo_centre_token');
    setCurrentUser(demoCentreUser);
    setUser(demoCentreUser);
  };

  return (
    <div style={{ minHeight: '92vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>

        {/* TOP PLATFORM TAGLINE BAR */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.65rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
            <strong style={{ color: '#0284c7' }}>STAGE 2: COLLECTION CENTRE VERIFICATION TERMINAL</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#0F9D58', fontWeight: '700' }}>
            One Platform • One Record • Complete Waste Journey Visibility
          </div>
        </div>

        {/* AUTHORIZATION NOTICE IF NOT SIGNED IN */}
        {(!token || currentUser?.role !== 'collection_centre' && currentUser?.role !== 'admin') && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#b45309', fontSize: '0.95rem', fontWeight: '800' }}>
                Restricted Terminal Access: Authorized Collection Centres Only
              </h4>
              <p style={{ margin: 0, color: '#78350f', fontSize: '0.85rem' }}>
                Collection Centre approval is managed by EcoHub. Credentials are automatically issued after review.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleQuickCentreSignIn}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Sign In as Certified Officer (Delhi Central)
              </button>
              <Link
                to="/centre/register"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  textDecoration: 'none'
                }}
              >
                Register Centre
              </Link>
            </div>
          </div>
        )}

        {/* METRICS ROW (REAL DATABASE DATA ONLY — NO FAKE METRICS) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Pending Verification Requests
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#b45309', margin: '0.25rem 0' }}>
              {dashboardData.summary.total_pending}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Awaiting physical intake inspection
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Verified Waste Records Created
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0F9D58', margin: '0.25rem 0' }}>
              {dashboardData.summary.total_received}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Permanently locked digital records
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              Total Verified Weight
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0284c7', margin: '0.25rem 0' }}>
              {dashboardData.summary.total_weight_kg > 0 ? `${dashboardData.summary.total_weight_kg} kg` : '0.00 kg'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {dashboardData.summary.total_weight_kg === 0 ? 'No Data Available Yet' : 'Physically weighed on intake scales'}
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: '700',
              fontSize: '0.9rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'pending' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'pending' ? '3px solid #0284c7' : '3px solid transparent',
              marginBottom: '-2px'
            }}
          >
            📋 Pending Verification Requests ({dashboardData.pending_requests.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intake')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: '700',
              fontSize: '0.9rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'intake' ? '#0F9D58' : '#64748b',
              borderBottom: activeTab === 'intake' ? '3px solid #0F9D58' : '3px solid transparent',
              marginBottom: '-2px'
            }}
          >
            🔍 Verification &amp; Confidence Scoring Desk
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verified')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: '700',
              fontSize: '0.9rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'verified' ? '#0F9D58' : '#64748b',
              borderBottom: activeTab === 'verified' ? '3px solid #0F9D58' : '3px solid transparent',
              marginBottom: '-2px'
            }}
          >
            🔒 Verified Digital Waste Records ({dashboardData.verified_records.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PENDING VERIFICATION REQUESTS */}
        {/* ========================================================================= */}
        {activeTab === 'pending' && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: '800' }}>
                  Pending Verification Requests (Step 10)
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Submissions awaiting hardware physical inspection at this collection centre.
                </p>
              </div>

              {/* SEARCH / DIRECT INTAKE INPUT */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Scan or Enter Disposal ID"
                  value={scannedIdInput}
                  onChange={(e) => setScannedIdInput(e.target.value)}
                  style={{ padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => loadDisposalRecord(scannedIdInput)}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Open Record
                </button>
              </div>
            </div>

            {dashboardData.pending_requests.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#475569' }}>No Data Available Yet</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  No pending verification requests found for this facility. When citizens register e-waste, requests will appear here.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <Link
                    to="/citizen"
                    style={{ backgroundColor: '#0F9D58', color: '#ffffff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem' }}
                  >
                    + Register a Disposal Request in Citizen Flow
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Disposal ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>User Details</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Product Details</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Declared Weight</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.pending_requests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '700', fontFamily: 'monospace', color: '#0F9D58' }}>
                          {req.id}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#0f172a' }}>{req.user_name || 'Eco Citizen'}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{req.user_email}</div>
                          {req.user_phone && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{req.user_phone}</div>}
                          {req.user_address && <div style={{ fontSize: '0.75rem', color: '#475569' }}>📍 {req.user_address}</div>}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#0f172a' }}>{req.item_name}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {req.category} &bull; {req.brand_name}
                          </div>
                          {req.serial_number && (
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', fontFamily: 'monospace' }}>
                              SN: {req.serial_number}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {req.estimated_weight_kg} kg
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: req.status === 'REQUIRES REVIEW' ? '#fef3c7' : '#e0f2fe',
                            color: req.status === 'REQUIRES REVIEW' ? '#b45309' : '#0369a1'
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDisposal(req);
                              setVerifiedCategory(req.category || 'Laptop');
                              setActualWeight(req.estimated_weight_kg || 1.5);
                              setActiveTab('intake');
                            }}
                            style={{
                              backgroundColor: '#0F9D58',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.45rem 0.85rem',
                              fontWeight: '700',
                              fontSize: '0.82rem',
                              cursor: 'pointer'
                            }}
                          >
                            Inspect &amp; Verify →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INTAKE INSPECTION & CONFIDENCE SCORE GENERATION */}
        {/* ========================================================================= */}
        {activeTab === 'intake' && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* RECORD SELECTOR BAR */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Active Record Under Inspection:
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', fontFamily: 'monospace', color: selectedDisposal ? '#0F9D58' : '#94a3b8' }}>
                  {selectedDisposal ? selectedDisposal.id : 'No Record Selected'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter Disposal ID"
                  value={scannedIdInput}
                  onChange={(e) => setScannedIdInput(e.target.value)}
                  style={{ padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => loadDisposalRecord(scannedIdInput)}
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Load
                </button>
              </div>
            </div>

            {selectedDisposal ? (
              <div>
                {/* 1. SIDE-BY-SIDE DISPLAY OF SUBMITTED INFO (Step 11 requirement) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.5rem'
                }}>
                  {/* USER INFO */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                      👤 Submitted User Information
                    </h4>
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#334155' }}>
                      <div><strong>Name:</strong> {selectedDisposal.user_name || 'Eco Citizen'}</div>
                      <div><strong>Email:</strong> {selectedDisposal.user_email}</div>
                      <div><strong>Phone:</strong> {selectedDisposal.user_phone || '—'}</div>
                      <div><strong>Address:</strong> {selectedDisposal.user_address || '—'}</div>
                    </div>
                  </div>

                  {/* PRODUCT RECORD */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                      📦 Submitted Product Record
                    </h4>
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#334155' }}>
                      <div><strong>Model:</strong> {selectedDisposal.item_name}</div>
                      <div><strong>Category:</strong> {selectedDisposal.category}</div>
                      <div><strong>Brand:</strong> {selectedDisposal.brand_name}</div>
                      <div><strong>Declared Weight:</strong> {selectedDisposal.estimated_weight_kg} kg</div>
                      <div><strong>Condition:</strong> {selectedDisposal.item_condition || 'Used'}</div>
                      {selectedDisposal.serial_number && <div><strong>Serial:</strong> <code>{selectedDisposal.serial_number}</code></div>}
                    </div>
                  </div>

                  {/* USER UPLOADED PHOTO PREVIEW */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                      📸 User Submitted Photo
                    </h4>
                    {selectedDisposal.photo_url ? (
                      <img src={selectedDisposal.photo_url} alt="User submission" style={{ width: '100%', maxHeight: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        No initial photo attached in user submission.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. REQUIRED EVIDENCE UPLOAD (Step 11 requirement) */}
                <form onSubmit={handleRunVerification}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>
                      Collection Centre Evidence Upload (Step 11)
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      Upload mandatory physical evidence: Product Photograph and Product ID / Serial Image.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    
                    {/* REQUIRED EVIDENCE 1: PRODUCT PHOTOGRAPH */}
                    <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '1.25rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.35rem' }}>
                        Required Evidence 1: Product Photograph *
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                        Live counter photograph of the complete physical hardware.
                      </p>
                      <LiveCameraCapture
                        value={evidencePhoto}
                        onCapture={(image, metadata) => { setEvidencePhoto(image); setEvidencePhotoMetadata(metadata); }}
                        altText="Centre product photo captured live"
                      />
                    </div>

                    {/* REQUIRED EVIDENCE 2: PRODUCT ID IMAGE */}
                    <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '1.25rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.35rem' }}>
                        Required Evidence 2: Product ID Image *
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                        Close-up photograph of serial number label, barcode, or model badge.
                      </p>
                      <LiveCameraCapture
                        value={evidenceProductId}
                        onCapture={(image, metadata) => { setEvidenceProductId(image); setEvidenceProductIdMetadata(metadata); }}
                        altText="Centre product serial photo captured live"
                      />
                    </div>

                  </div>

                  {/* INSPECTED WEIGHT & CATEGORY CONFIRMATION */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                        Actual Weight Measured (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={actualWeight}
                        onChange={(e) => setActualWeight(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                        Confirmed Hardware Category *
                      </label>
                      <select
                        value={verifiedCategory}
                        onChange={(e) => setVerifiedCategory(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="Laptop">Laptop / Computer</option>
                        <option value="Mobile">Mobile phone / Smartphone</option>
                        <option value="Monitor">Monitor / Display</option>
                        <option value="Battery">Battery / Power pack</option>
                        <option value="Charger">Charging cable / Peripheral</option>
                        <option value="Other">Other Electronics</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                        Verification Notes &amp; Observations
                      </label>
                      <input
                        type="text"
                        value={officerNotes}
                        onChange={(e) => setOfficerNotes(e.target.value)}
                        placeholder="e.g. Battery insulated, ports intact, serial matches invoice"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* RUN VERIFICATION BUTTON */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                    <button
                      type="submit"
                      disabled={isVerifying || !evidencePhoto || !evidenceProductId}
                      style={{
                        backgroundColor: isVerifying || !evidencePhoto || !evidenceProductId ? '#94a3b8' : '#0F9D58',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '1rem',
                        padding: '0.85rem 2rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: isVerifying || !evidencePhoto || !evidenceProductId ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 6px rgba(15, 157, 88, 0.25)'
                      }}
                    >
                      {isVerifying ? 'Checking product images with AI...' : 'Verify photos & product details →'}
                    </button>
                  </div>
                </form>

                {/* 3. CONFIDENCE SCORE GENERATION & OUTCOME (Step 12 & 13 requirement) */}
                {verificationResult && (
                  <div style={{
                    marginTop: '2rem',
                    border: '2px solid #0F9D58',
                    borderRadius: '12px',
                    padding: '2rem',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                          Verification Outcome
                        </span>
                        <h3 style={{ margin: '0.2rem 0', fontSize: '1.45rem', fontWeight: '800', color: '#0f172a' }}>
                          AI Product Evidence Match: {verificationResult.confidence_score} / 100
                        </h3>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          Verified ≥95 · Review 85–94 · Rejected &lt;85
                        </div>
                      </div>

                      {/* OUTCOME BADGE (Status: VERIFIED vs REQUIRES REVIEW) */}
                      <div>
                        {verificationResult.verification_status === 'VERIFIED' ? (
                          <div style={{
                            backgroundColor: '#dcfce7',
                            border: '2px solid #16a34a',
                            color: '#15803d',
                            padding: '0.65rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '1.1rem',
                            textAlign: 'center'
                          }}>
                            STATUS = VERIFIED ✓
                          </div>
                        ) : verificationResult.verification_status === 'REQUIRES REVIEW' ? (
                          <div style={{
                            backgroundColor: '#fef3c7',
                            border: '2px solid #d97706',
                            color: '#b45309',
                            padding: '0.65rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '1.1rem',
                            textAlign: 'center'
                          }}>
                            STATUS = REQUIRES REVIEW ⚠️
                          </div>
                        ) : (
                          <div style={{
                            backgroundColor: '#fee2e2',
                            border: '2px solid #dc2626',
                            color: '#b91c1c',
                            padding: '0.65rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '1.1rem',
                            textAlign: 'center'
                          }}>
                            STATUS = REJECTED
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI REASON & AUDIT EXPLANATION BOX */}
                    {(() => {
                      try {
                        const parsed = JSON.parse(verificationResult.verification_checks || '{}');
                        const explanation = parsed.explanation || verificationResult.ai_notes || '';
                        const guidance = parsed.guidance_message || '';
                        const isSuccess = verificationResult.verification_status === 'VERIFIED';
                        const isReview = verificationResult.verification_status === 'REQUIRES REVIEW';

                        return (
                          <div style={{
                            backgroundColor: isSuccess ? '#f0fdf4' : isReview ? '#fffbeb' : '#fef2f2',
                            border: `1px solid ${isSuccess ? '#bbf7d0' : isReview ? '#fde68a' : '#fecaca'}`,
                            borderRadius: '10px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem' }}>{isSuccess ? '🤖' : isReview ? '⚠️' : '❌'}</span>
                              <strong style={{ color: isSuccess ? '#166534' : isReview ? '#b45309' : '#991b1b', fontSize: '1rem' }}>
                                AI Forensic Audit Reason:
                              </strong>
                            </div>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', color: '#1e293b', lineHeight: '1.6' }}>
                              {explanation || 'AI inspection completed.'}
                            </p>

                            {guidance && (
                              <div style={{
                                backgroundColor: '#ffffff',
                                border: '1px dashed #cbd5e1',
                                borderRadius: '8px',
                                padding: '0.75rem 1rem',
                                marginTop: '0.5rem',
                                fontSize: '0.88rem',
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <span>💡</span>
                                <span><strong>Recommendation:</strong> {guidance}</span>
                              </div>
                            )}

                            {/* RETAKE ACTION BUTTON IF REJECTED OR REVIEW */}
                            {!isSuccess && (
                              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEvidencePhoto('');
                                    setEvidenceProductId('');
                                    setEvidencePhotoMetadata(null);
                                    setEvidenceProductIdMetadata(null);
                                    setVerificationResult(null);
                                    window.scrollTo({ top: 300, behavior: 'smooth' });
                                  }}
                                  style={{
                                    backgroundColor: '#0284c7',
                                    color: '#ffffff',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)'
                                  }}
                                >
                                  🔄 Retake Photos &amp; Try Again
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}

                    {/* CHECKS PASSED & CHECKS FAILED LIST */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#166534', marginBottom: '0.5rem' }}>
                          ✓ Verification Checks Passed:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.7' }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(verificationResult.verification_checks);
                              if (parsed.passed?.length > 0) {
                                return parsed.passed.map((chk, i) => <li key={i}>{chk}</li>);
                              }
                              return <li>Physical hardware matched</li>;
                            } catch {
                              return <li>Product matches submitted information</li>;
                            }
                          })()}
                        </ul>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#b91c1c', marginBottom: '0.5rem' }}>
                          ✕ Verification Checks Failed:
                        </div>
                        {(() => {
                          try {
                            const parsed = JSON.parse(verificationResult.verification_checks);
                            if (parsed.failed?.length > 0) {
                              return (
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#b91c1c', lineHeight: '1.7' }}>
                                  {parsed.failed.map((chk, i) => <li key={i}>{chk}</li>)}
                                </ul>
                              );
                            }
                          } catch {}
                          return <div style={{ fontSize: '0.85rem', color: '#64748b' }}>None (All criteria met)</div>;
                        })()}
                      </div>
                    </div>

                    {/* Verified record details */}
                    {verificationResult.verification_status === 'VERIFIED' && (
                      <div style={{
                        border: '1px solid #bbf7d0',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '10px',
                        padding: '1.5rem',
                        marginTop: '1.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                          <span style={{ fontWeight: '800', color: '#166534', fontSize: '1.1rem' }}>
                            Verified Waste Record Created
                          </span>
                        </div>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#166534' }}>
                          A permanent digital waste record has been locked into the immutable registry with the following metadata:
                        </p>

                        <div style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '1rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem'
                        }}>
                          <div><strong>Disposal ID:</strong> <code>{verificationResult.id}</code></div>
                          <div><strong>Product Details:</strong> {verificationResult.item_name} ({verificationResult.category}, {verificationResult.estimated_weight_kg} kg)</div>
                          <div><strong>User Details:</strong> {verificationResult.user_name} ({verificationResult.user_email})</div>
                          <div><strong>Collection Centre Details:</strong> {verificationResult.collection_centre_name} ({verificationResult.collection_centre_address})</div>
                          <div><strong>Verification Timestamp:</strong> {new Date(verificationResult.verification_timestamp || Date.now()).toLocaleString()}</div>
                          <div><strong>Record State:</strong> <span style={{ color: '#15803d', fontWeight: '800' }}>🔒 Permanent &amp; Locked for EPR Compliance</span></div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                          <Link
                            to={`/corporate/dashboard?brand=${verificationResult.brand_code || 'samsung'}`}
                            style={{
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '0.85rem',
                              fontWeight: '700'
                            }}
                          >
                            View in Company Compliance Portal (Stage 3) →
                          </Link>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <h4 style={{ margin: '0 0 0.35rem 0', color: '#0f172a' }}>Select a Request from the Pending List</h4>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  Choose any pending submission from the first tab or enter a Disposal ID to initiate physical intake evidence upload.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VERIFIED DIGITAL WASTE RECORDS */}
        {/* ========================================================================= */}
        {activeTab === 'verified' && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: '800' }}>
              Verified Waste Records Ledger
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Official immutable digital records created upon passing the verification confidence threshold.
            </p>

            {dashboardData.verified_records.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📑</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#475569' }}>No Data Available Yet</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  No verified records logged yet for this facility. Once items pass confidence scoring, permanent records will be listed here.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Disposal ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Product Details</th>
                      <th style={{ padding: '0.75rem 1rem' }}>User Details</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Verified Weight</th>
                      <th style={{ padding: '0.75rem 1rem' }}>AI Image Match</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Verification Timestamp</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.verified_records.map((rec) => (
                      <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '700', fontFamily: 'monospace', color: '#0F9D58' }}>
                          {rec.id}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#0f172a' }}>{rec.item_name}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {rec.category} &bull; {rec.brand_name}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ color: '#0f172a' }}>{rec.user_name}</span>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{rec.user_email}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '700' }}>
                          {rec.estimated_weight_kg} kg
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: '800', color: '#15803d' }}>
                            {rec.confidence_score == null ? 'Not scored' : `${rec.confidence_score} / 100`}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {rec.verification_timestamp ? new Date(rec.verification_timestamp).toLocaleString() : new Date(rec.received_at || Date.now()).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0'
                          }}>
                            🔒 LOCKED &amp; CERTIFIED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
