import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';

export default function WasteJourneyExplorer({ initialDisposalId = '', embedded = false }) {
  const [searchId, setSearchId] = useState(initialDisposalId);
  const [journeyData, setJourneyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sampleDisposals, setSampleDisposals] = useState([]);

  useEffect(() => {
    // Load recent disposal IDs as quick selection chips
    apiRequest('/api/disposals/my')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setSampleDisposals(res.slice(0, 5));
          if (!searchId) {
            loadJourney(res[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialDisposalId) {
      setSearchId(initialDisposalId);
      loadJourney(initialDisposalId);
    }
  }, [initialDisposalId]);

  const loadJourney = async (idToFetch) => {
    const id = (idToFetch || searchId || '').trim();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/disposals/journey/${encodeURIComponent(id)}`);
      setJourneyData(data);
    } catch (err) {
      setError(err.message || `No journey records found for "${id}".`);
      setJourneyData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadJourney(searchId);
  };

  const stage1 = journeyData?.stage_1_user_engagement;
  const stage2 = journeyData?.stage_2_collection_centre_verification;
  const stage3 = journeyData?.stage_3_verified_waste_record;
  const stage4 = journeyData?.stage_4_company_compliance;

  return (
    <div className={`waste-journey-card ${embedded ? 'embedded' : ''}`} style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: embedded ? '1.5rem' : '2rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)',
      color: '#0f172a'
    }}>
      {/* HEADER & TAGLINE */}
      <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#0F9D58'
          }} />
          <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0F9D58' }}>
            Official Audit Trail • Complete Traceability
          </span>
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 0.4rem 0', color: '#0f172a' }}>
          End-to-End Waste Journey Verification
        </h2>
        <p style={{ margin: 0, fontSize: '0.92rem', color: '#64748b' }}>
          <strong style={{ color: '#0284c7' }}>One Platform • One Record • Complete Waste Journey Visibility</strong>
        </p>
      </div>

      {/* SEARCH / DISPOSAL ID LOOKUP */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Enter Disposal ID (e.g. EH-2026-10001)"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.95rem',
              fontFamily: 'monospace',
              color: '#0f172a',
              backgroundColor: '#f8fafc'
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !searchId.trim()}
          style={{
            backgroundColor: '#0F9D58',
            color: '#ffffff',
            fontWeight: '700',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          {loading ? 'Verifying Ledger...' : 'Inspect Journey →'}
        </button>
      </form>

      {/* QUICK SELECTION PILLS */}
      {sampleDisposals.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: '#64748b', fontWeight: '600' }}>Recent Submissions:</span>
          {sampleDisposals.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSearchId(item.id);
                loadJourney(item.id);
              }}
              style={{
                background: searchId === item.id ? '#e6f4ea' : '#f1f5f9',
                color: searchId === item.id ? '#0F9D58' : '#334155',
                border: searchId === item.id ? '1px solid #0F9D58' : '1px solid #e2e8f0',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {item.id} ({item.item_name})
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '0.9rem 1.25rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          marginBottom: '1.5rem'
        }}>
          {error}
        </div>
      )}

      {/* 4-STAGE INTERACTIVE WASTE JOURNEY TIMELINE */}
      {journeyData ? (
        <div className="journey-timeline-wrapper">
          {/* OVERVIEW BADGE */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>
                Disposal ID Reference
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a' }}>
                {journeyData.disposal_id}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '700',
                backgroundColor: journeyData.current_status.includes('Verified') ? '#dcfce7' : journeyData.current_status.includes('Review') ? '#fef3c7' : '#e0f2fe',
                color: journeyData.current_status.includes('Verified') ? '#15803d' : journeyData.current_status.includes('Review') ? '#b45309' : '#0369a1',
                border: '1px solid currentColor'
              }}>
                {journeyData.current_status}
              </span>
              {journeyData.is_locked && (
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1'
                }}>
                  🔒 Permanent Locked Record
                </span>
              )}
            </div>
          </div>

          {/* STAGE CARDS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            
            {/* STAGE 1: USER ENGAGEMENT & ID GENERATION */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '1.25rem',
              background: '#ffffff',
              borderTop: '4px solid #0F9D58'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0F9D58', letterSpacing: '0.05em' }}>
                  STAGE 01
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: '#dcfce7',
                  color: '#166534',
                  fontWeight: '700'
                }}>
                  COMPLETED
                </span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                User Engagement &amp; ID Generation
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                User scans product QR, selects category, inputs device &amp; contact info, and binds record to collection centre.
              </p>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>User:</strong> {stage1?.user?.name}
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Contact:</strong> {stage1?.user?.email} {stage1?.user?.phone !== '—' ? `• ${stage1?.user?.phone}` : ''}
                </div>
                {stage1?.user?.address && stage1?.user?.address !== '—' && (
                  <div>
                    <strong style={{ color: '#475569' }}>Address:</strong> {stage1?.user?.address}
                  </div>
                )}
                <div>
                  <strong style={{ color: '#475569' }}>Product:</strong> {stage1?.product?.item_name} ({stage1?.product?.category})
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Estimated Weight:</strong> {stage1?.product?.estimated_weight_kg} kg
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Selected Centre:</strong> {stage1?.selected_collection_centre?.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Registered: {stage1?.timestamp ? new Date(stage1.timestamp).toLocaleString() : '—'}
                </div>
              </div>

              {stage1?.product?.photo_url && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>User Uploaded Photo:</span>
                  <img
                    src={stage1.product.photo_url}
                    alt="Product Submission"
                    style={{ width: '100%', maxHeight: '110px', objectFit: 'cover', borderRadius: '6px', marginTop: '0.35rem', border: '1px solid #e2e8f0' }}
                  />
                </div>
              )}
            </div>

            {/* STAGE 2: COLLECTION CENTRE VERIFICATION */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '1.25rem',
              background: '#ffffff',
              borderTop: '4px solid #0284c7'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0284c7', letterSpacing: '0.05em' }}>
                  STAGE 02
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: stage2?.step_completed ? '#e0f2fe' : '#fef3c7',
                  color: stage2?.step_completed ? '#0369a1' : '#b45309',
                  fontWeight: '700'
                }}>
                  {stage2?.step_completed ? stage2.verification_outcome : 'AWAITING INTAKE'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                Collection Centre Verification
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                Physical intake desk inspection: Product ID image &amp; hardware photograph evidence with confidence scoring.
              </p>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>Authorized Facility:</strong> {stage2?.collection_centre?.name || '—'}
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Verified By:</strong> {stage2?.verified_by || 'Pending intake inspection'}
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Confidence Score:</strong>{' '}
                  <span style={{
                    fontWeight: '800',
                    color: (stage2?.confidence_score || 0) >= 80 ? '#15803d' : '#b45309',
                    fontSize: '1rem'
                  }}>
                    {stage2?.confidence_score || 0} / 100
                  </span>{' '}
                  <small style={{ color: '#64748b' }}>(Threshold: 80)</small>
                </div>
                
                {stage2?.checks_passed?.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534' }}>Passed Criteria ({stage2.checks_passed.length}):</span>
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#334155' }}>
                      {stage2.checks_passed.map((chk, i) => (
                        <li key={i}>{chk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {stage2?.checks_failed?.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#b91c1c' }}>Failed Checks ({stage2.checks_failed.length}):</span>
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#b91c1c' }}>
                      {stage2.checks_failed.map((chk, i) => (
                        <li key={i}>{chk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {stage2?.timestamp && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Intake Evaluated: {new Date(stage2.timestamp).toLocaleString()}
                  </div>
                )}
              </div>

              {/* REQUIRED EVIDENCE PREVIEW */}
              {(stage2?.required_evidence?.product_photo || stage2?.required_evidence?.product_id_image) && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Intake Evidence Images:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.35rem' }}>
                    {stage2.required_evidence.product_photo && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '2px' }}>Product Photo</div>
                        <img src={stage2.required_evidence.product_photo} alt="Intake Unit" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                      </div>
                    )}
                    {stage2.required_evidence.product_id_image && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '2px' }}>Product ID Badge</div>
                        <img src={stage2.required_evidence.product_id_image} alt="Product ID Badge" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STAGE 3: VERIFIED WASTE RECORD CREATION */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '1.25rem',
              background: '#ffffff',
              borderTop: '4px solid #16a34a'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16a34a', letterSpacing: '0.05em' }}>
                  STAGE 03
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: stage3?.record_created ? '#dcfce7' : '#f1f5f9',
                  color: stage3?.record_created ? '#15803d' : '#64748b',
                  fontWeight: '700'
                }}>
                  {stage3?.record_created ? 'RECORD CERTIFIED' : 'PENDING'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                Verified Waste Record Creation
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                Permanent digital waste record locked with cryptographic proof, timestamp, and custody binding.
              </p>

              {stage3?.record_created ? (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Record ID:</strong>{' '}
                    <span style={{ fontFamily: 'monospace' }}>{stage3.permanent_record_id}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Status:</strong>{' '}
                    <span style={{ color: '#15803d', fontWeight: '700' }}>Verified Waste Record Created</span>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Product:</strong> {stage3.digital_waste_record?.product_details}
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>User:</strong> {stage3.digital_waste_record?.user_details}
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Facility:</strong> {stage3.digital_waste_record?.collection_centre_details}
                  </div>
                  <div style={{ wordBreak: 'break-all', fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                    <strong>SHA-256 Chain:</strong> {stage3.digital_waste_record?.immutable_sha256_hash}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#0F9D58', fontWeight: '700', marginTop: '0.2rem' }}>
                    ✓ Locked &amp; Certified for EPR Audit
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem'
                }}>
                  Digital waste record will be permanently generated and locked once physical verification passes the confidence threshold.
                </div>
              )}
            </div>

            {/* STAGE 4: COMPANY COMPLIANCE & REPORTING */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '1.25rem',
              background: '#ffffff',
              borderTop: '4px solid #6366f1'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#6366f1', letterSpacing: '0.05em' }}>
                  STAGE 04
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: stage3?.record_created ? '#ede9fe' : '#f1f5f9',
                  color: stage3?.record_created ? '#6d28d9' : '#64748b',
                  fontWeight: '700'
                }}>
                  {stage3?.record_created ? 'EPR ALLOCATED' : 'WAITING RECORD'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                Company Compliance &amp; Reporting
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                Real waste records flow into the corporate ESG dashboard for EPR audit compliance and official ledger reporting.
              </p>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>Assigned Brand:</strong> {stage4?.company?.name || stage1?.product?.brand_name} ({stage4?.company?.brand_code?.toUpperCase()})
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Compliance Status:</strong> {stage4?.compliance_status}
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Audit Trail Entries:</strong> {stage4?.traceability_logs?.length || 0} events recorded
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ✓ Downloadable in Corporate Audit Ledger (PDF/CSV)
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ✓ Backed by Genuine Physical Verification Evidence
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '10px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a' }}>Enter a Disposal ID to Inspect Complete Waste Journey</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '480px', marginInline: 'auto' }}>
            Trace every step from initial citizen QR scan to collection centre physical intake, confidence scoring, digital record creation, and corporate EPR reporting.
          </p>
        </div>
      )}
    </div>
  );
}
