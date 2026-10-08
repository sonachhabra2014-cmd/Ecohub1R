import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NearbyCentersMap from '../NearbyCentersMap';
import { apiRequest } from '../api';
import { QRCodeSVG } from 'qrcode.react';
import LiveCameraCapture from '../components/LiveCameraCapture';

// ---------------------------------------------------------------------------
// Debug helpers (opt-out: localStorage ecohub_debug = '0')
// ---------------------------------------------------------------------------
function debugLog(label, data) {
  try {
    if (localStorage.getItem('ecohub_debug') === '0') return;
    // eslint-disable-next-line no-console
    console.log(`[EcoHub:Disposal] ${label}`, data);
  } catch (e) {
    /* logging must never break the flow */
  }
}

function isDataImage(image) {
  if (typeof image !== 'string') return false;
  const value = image.trim();
  return /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,[A-Za-z0-9+/=\s]+$/i.test(value);
}

function isStoredImagePath(image) {
  if (typeof image !== 'string') return false;
  return /^(https?:\/\/|\/uploads\/|\/images\/)/i.test(image.trim());
}

function isEvidenceImage(image) {
  return isDataImage(image) || isStoredImagePath(image);
}

function DisposalSubmission() {
  const navigate = useNavigate();

  // Step 1 Form States
  const [selectedCategory, setSelectedCategory] = useState('Mobile');
  const [itemName, setItemName] = useState('Samsung Galaxy S20');
  const [selectedBrand, setSelectedBrand] = useState('samsung');
  const [serialNumber, setSerialNumber] = useState('');
  const [itemCondition, setItemCondition] = useState('Faulty Screen & Battery');
  const [estimatedWeight, setEstimatedWeight] = useState(0.25);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoCaptureMetadata, setPhotoCaptureMetadata] = useState(null);
  const [productIdImage, setProductIdImage] = useState('');
  const [productIdCaptureMetadata, setProductIdCaptureMetadata] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('Tomorrow, 11:00 AM – 2:00 PM');


  // GPS & Centre Selection States
  const [location, setLocation] = useState({ lat: 28.6315, lng: 77.2167, accuracy: 15, source: 'GPS Satellite' });
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [loadingCentres, setLoadingCentres] = useState(false);
  const [radiusFilter, setRadiusFilter] = useState('all');

  // Submission Result States
  const [submitting, setSubmitting] = useState(false);
  const [createdDisposal, setCreatedDisposal] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const categories = [
    { name: 'Laptop', icon: '💻' },
    { name: 'Mobile', icon: '📱' },
    { name: 'Monitor', icon: '🖥️' },
    { name: 'Charger', icon: '🔌' },
    { name: 'Battery', icon: '🔋' },
    { name: 'Other', icon: '📦' }
  ];


  const brandOptions = [
    { code: 'samsung', name: 'Samsung Electronics', logo: '📱' },
    { code: 'apple', name: 'Apple Inc.', logo: '🍏' },
    { code: 'hp', name: 'HP Inc.', logo: '💻' },
    { code: 'dell', name: 'Dell Technologies', logo: '🖥️' },
    { code: 'lenovo', name: 'Lenovo Group', logo: '⌨️' },
    { code: 'sony', name: 'Sony Corporation', logo: '🎮' }
  ];

  useEffect(() => {
    fetchCentres(location);
  }, []);

  const fetchCentres = async (coords) => {
    setLoadingCentres(true);
    try {
      let url = '/api/collection-centres';
      if (coords) url += `?lat=${coords.lat}&lng=${coords.lng}`;
      const data = await apiRequest(url);
      if (Array.isArray(data) && data.length > 0) {
        setCentres(data);
        if (!selectedCentre) setSelectedCentre(data[0]);
      }
    } catch (err) {
      console.warn('Using local centres fallback:', err);
    } finally {
      setLoadingCentres(false);
    }
  };

  const handleSubmitDisposal = async (e) => {
    e.preventDefault();
    if (!selectedCentre) {
      alert('Please select an authorized collection centre.');
      return;
    }
    if (!isEvidenceImage(photoPreview) || !isEvidenceImage(productIdImage)) {
      const missing = [];
      if (!isEvidenceImage(photoPreview)) missing.push('product photo');
      if (!isEvidenceImage(productIdImage)) missing.push('serial-label or product-ID image');
      setSubmissionError(`Add a valid ${missing.join(' and ')} before submitting.`);
      return;
    }

    const defaultMeta = {
      capture_method: 'file_upload',
      captured_at: new Date().toISOString(),
      device_id: 'ecohub_browser_submission',
      device_info: { user_agent: navigator.userAgent }
    };
    const resolvedPhotoMeta = photoCaptureMetadata || defaultMeta;
    const resolvedIdMeta = productIdCaptureMetadata || defaultMeta;
    const resolvedCaptureMethod = (resolvedPhotoMeta.capture_method === 'live_camera' || resolvedIdMeta.capture_method === 'live_camera')
      ? 'live_camera'
      : 'file_upload';

    setSubmitting(true);
    setSubmissionError('');
    debugLog('submitting disposal (authenticated)', {
      hasPhoto: Boolean(photoPreview),
      photoPrefix: String(photoPreview).slice(0, 32),
      hasProductId: Boolean(productIdImage),
      productIdPrefix: String(productIdImage).slice(0, 32),
      capture_method: resolvedCaptureMethod,
      centreId: selectedCentre?.id
    });
    try {
      const brandObj = brandOptions.find(b => b.code === selectedBrand) || brandOptions[0];
      const res = await apiRequest('/api/disposals', 'POST', {
        item_name: itemName,
        category: selectedCategory,
        brand_code: selectedBrand,
        brand_name: brandObj.name,
        item_condition: itemCondition,
        estimated_weight_kg: parseFloat(estimatedWeight),
        product_photo: photoPreview,
        photo_url: photoPreview,
        product_id_image: productIdImage,
        capture_method: resolvedCaptureMethod,
        capture_metadata: {
          product_photo: resolvedPhotoMeta,
          product_id_photo: resolvedIdMeta
        },
        serial_number: serialNumber,
        collection_centre_id: selectedCentre.id,
        appointment_time: appointmentTime
      });


      if (res && res.disposal) {
        setCreatedDisposal(res.disposal);
        setShowEmailModal(true); // Open Email #1 preview automatically
      }
    } catch (err) {
      console.error('Submission failed:', err);
      alert(err.message || 'Disposal could not be registered. No pass was created.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="submission-page-wrapper">
      {/* HEADER */}
      <div className="submission-header">
        <span className="step-badge">E-WASTE SUBMISSION</span>
        <h1>♻️ E-Waste Submission & Digital Pass Generator</h1>
        <p>Register your electronic device for responsible recycling, choose your brand, and select an authorized GPS collection centre.</p>
      </div>

      {!createdDisposal ? (
        <form onSubmit={handleSubmitDisposal} className="submission-form-layout">
          {/* LEFT COLUMN: ITEM SPECIFICATIONS */}
          <div className="form-left-col">
            {/* Category Selector */}
            <div className="form-section-card">
              <h3>1. Select Device Category</h3>
              <div className="categories-pill-grid">
                {categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`category-pill ${selectedCategory === c.name ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(c.name);
                      if (c.name.includes('Mobile')) setItemName('Samsung Galaxy S20');
                      else if (c.name.includes('Laptop')) setItemName('HP Pavilion Eco');
                      else if (c.name.includes('Monitor')) setItemName('Dell UltraSharp 24');
                    }}
                  >
                    <span className="cat-icon">{c.icon}</span>
                    <span className="cat-text">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand & Item Name */}
            <div className="form-section-card">
              <h3>2. Device Brand & Model Name</h3>
              <div className="brand-chips-row">
                {brandOptions.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    className={`brand-chip-btn ${selectedBrand === b.code ? 'selected' : ''}`}
                    onClick={() => setSelectedBrand(b.code)}
                  >
                    <span>{b.logo}</span>
                    <span>{b.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <div className="form-field-group">
                <label>Exact Device Model Name:</label>
                <input
                  type="text"
                  className="text-input"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Samsung Galaxy S20 / Dell Inspiron 15"
                  required
                />
              </div>

              <div className="form-field-group" style={{ marginTop: '12px' }}>
                <label>
                  {selectedCategory === 'Mobile' ? 'IMEI Number (15-digit) (Recommended):' : 'Device Serial Number (Optional):'}
                </label>
                <input
                  type="text"
                  className="text-input"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  placeholder={selectedCategory === 'Mobile' ? 'e.g. 352099001761482' : 'e.g. CN-0H755-72872-68P'}
                />
              </div>

              <div className="form-fields-grid-2">
                <div className="form-field-group">
                  <label>Condition / Defect:</label>
                  <input
                    type="text"
                    className="text-input"
                    value={itemCondition}
                    onChange={(e) => setItemCondition(e.target.value)}
                    placeholder="e.g. Broken display, swollen battery"
                  />
                </div>
                <div className="form-field-group">
                  <label>Est. Weight (kg):</label>
                  <input
                    type="number"
                    step="0.05"
                    className="text-input"
                    value={estimatedWeight}
                    onChange={(e) => setEstimatedWeight(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section-card">
              <h3>3. Add both required product images</h3>
              <p>Capture with the live camera or upload a photo. Both methods are accepted.</p>
              <div className="photo-upload-zone">
                <LiveCameraCapture
                  value={photoPreview}
                  onCapture={(image, metadata) => { debugLog('product photo captured', { prefix: String(image).slice(0, 32), capture_method: metadata?.capture_method }); setPhotoPreview(image); setPhotoCaptureMetadata(metadata); }}
                  altText="Product captured with live camera"
                />
                <LiveCameraCapture
                  value={productIdImage}
                  onCapture={(image, metadata) => { debugLog('product ID image captured', { prefix: String(image).slice(0, 32), capture_method: metadata?.capture_method }); setProductIdImage(image); setProductIdCaptureMetadata(metadata); }}
                  altText="Product ID captured with live camera"
                />
              </div>
              {submissionError && <p role="alert">{submissionError}</p>}
            </div>
          </div>

          {/* RIGHT COLUMN: GPS COLLECTION CENTRE SELECTION */}
          <div className="form-right-col">
            <div className="form-section-card sticky-card">
              <div className="card-header-flex">
                <h3>4. Select Nearest Collection Centre</h3>
                <span className="gps-live-tag">🛰️ Live GPS Active</span>
              </div>

              <p className="hint-text">
                Authorized e-waste collection centre closest to your current coordinates:
              </p>

              {/* Leaflet GPS Radar Map */}
              {location && (
                <div className="map-embed-wrapper">
                  <NearbyCentersMap
                    userLocation={location}
                    centers={centres}
                    selectedCenter={selectedCentre}
                    onSelectCenter={(c) => setSelectedCentre(c)}
                  />
                </div>
              )}

              {/* Centre Selection Cards */}
              <div className="centres-selection-list">
                {centres.map((centre, idx) => {
                  const isSelected = selectedCentre?.id === centre.id;
                  const isNearest = idx === 0;

                  return (
                    <div
                      key={centre.id || idx}
                      className={`centre-pick-item ${isSelected ? 'active' : ''} ${isNearest ? 'nearest-glow' : ''}`}
                      onClick={() => setSelectedCentre(centre)}
                    >
                      <div className="centre-pick-header">
                        <h4>{centre.name}</h4>
                        {centre.distance_km !== undefined && (
                          <span className="dist-tag">📍 {centre.distance_km} km</span>
                        )}
                      </div>
                      <p className="centre-addr">{centre.address}</p>
                      <div className="centre-pick-footer">
                        <span className="license-badge">License: {centre.license_no}</span>
                        {isSelected && <span className="selected-tag">✓ Drop-off Assigned</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-field-group" style={{ marginTop: '16px' }}>
                <label>Preferred Drop-off Appointment:</label>
                <input
                  type="text"
                  className="text-input"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="submit-disposal-btn"
                disabled={submitting}
              >
                {submitting ? 'Generating Official Pass...' : '✨ Generate Disposal ID & Digital QR Pass'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* CONFIRMATION PASS */
        <div className="disposal-pass-success-view">
          <div className="pass-card-container">
            <div className="pass-card-header">
              <div className="pass-brand">
                <h2>ECO<span>HUB</span> OFFICIAL DISPOSAL PASS</h2>
                <span className="pass-status-badge">ACTIVE &bull; PENDING DISPOSAL</span>
              </div>
              <div className="pass-id-display">
                <span className="pass-id-label">DISPOSAL TRACKING ID:</span>
                <span className="pass-id-value">{createdDisposal.id}</span>
              </div>
            </div>

            <div className="pass-card-body">
              <div className="pass-qr-column">
                <QRCodeSVG
                  value={createdDisposal.qr_data || createdDisposal.id}
                  size={220}
                  level="M"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  aria-label="EcoHub disposal verification QR code"
                />
                <div className="qr-scan-instruction">
                  <strong>QR pass sent by email</strong>
                  <span>Show the QR code from your email at the selected collection centre.</span>
                </div>
                <button
                  type="button"
                  className="simulate-scan-shortcut-btn"
                  onClick={() => navigate(`/collection-centre?dispId=${createdDisposal.id}`)}
                >
                  🚀 Test Scan at Collection Centre Portal &rarr;
                </button>
              </div>

              <div className="pass-details-column">
                <div className="pass-field-row">
                  <span className="label">Registered Device:</span>
                  <span className="val">{createdDisposal.item_name} ({createdDisposal.brand_name})</span>
                </div>
                <div className="pass-field-row">
                  <span className="label">Authorized Centre:</span>
                  <span className="val">{createdDisposal.collection_centre_name}</span>
                </div>
                <div className="pass-field-row">
                  <span className="label">Centre Address:</span>
                  <span className="val">{createdDisposal.collection_centre_address}</span>
                </div>
                <div className="pass-field-row">
                  <span className="label">Estimated Weight:</span>
                  <span className="val">{createdDisposal.estimated_weight_kg} kg</span>
                </div>
                <div className="pass-field-row">
                  <span className="label">Created At:</span>
                  <span className="val">{new Date(createdDisposal.created_at).toLocaleString()}</span>
                </div>

                <div className="email-dispatched-callout">
                  <div className="callout-icon">✉️</div>
                  <div>
                    <strong>Email #1 Confirmation Dispatched!</strong>
                    <p>We've sent your QR pass and appointment details to your registered email address.</p>
                  </div>
                  <button
                    type="button"
                    className="view-email-btn"
                    onClick={() => setShowEmailModal(true)}
                  >
                    View Email
                  </button>
                </div>
              </div>
            </div>

            <div className="pass-card-footer">
              <button
                type="button"
                className="action-link-btn"
                onClick={() => window.print()}
              >
                🖨️ Print / Save Pass (PDF)
              </button>
              <button
                type="button"
                className="action-link-btn secondary"
                onClick={() => setCreatedDisposal(null)}
              >
                + Submit Another Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL #1 DISPOSAL CONFIRMATION PREVIEW */}
      {showEmailModal && createdDisposal && (
        <div className="email-modal-backdrop" onClick={() => setShowEmailModal(false)}>
          <div className="email-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <span className="email-type-tag">✉️ AUTOMATED EMAIL #1 &bull; SENT TO USER</span>
              <button className="close-modal-btn" onClick={() => setShowEmailModal(false)}>✕</button>
            </div>

            <div className="email-modal-body">
              <div className="email-meta-header">
                <div><strong>To:</strong> {createdDisposal.user_name || 'EcoHub User'} &lt;{createdDisposal.user_email || 'registered email'}&gt;</div>
                <div><strong>Subject:</strong> Your EcoHub Disposal Pass & Appointment [{createdDisposal.id}]</div>
              </div>

              <div className="email-rendered-preview">
                <div className="email-preview-banner">
                  <h2>ECO<span style={{ color: '#22c55e' }}>HUB</span></h2>
                  <p>Responsible E-Waste Disposal & Sustainability Platform</p>
                </div>

                <div className="email-preview-content">
                  <p>Dear <strong>{createdDisposal.user_name || 'EcoHub User'}</strong>,</p>
                  <p>Thank you for contributing towards a greener future.</p>

                  <div className="highlight-id-box">
                    <span>Your Unique Disposal ID:</span>
                    <h3>{createdDisposal.id}</h3>
                  </div>

                  <div className="centre-info-box">
                    <h4>📍 Drop-off Appointment Details:</h4>
                    <p><strong>Collection Centre:</strong> {createdDisposal.collection_centre_name}</p>
                    <p><strong>Location:</strong> {createdDisposal.collection_centre_address}</p>
                    <p><strong>Hours:</strong> Monday – Saturday: 9:00 AM – 6:00 PM</p>
                  </div>

                  <div className="qr-preview-box">
                    <p><strong>YOUR DIGITAL VERIFICATION QR CODE</strong></p>
                    <QRCodeSVG
                      value={createdDisposal.qr_data || createdDisposal.id}
                      size={220}
                      level="M"
                      includeMargin
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                      aria-label="EcoHub disposal verification QR code"
                    />
                    <small>The QR pass is included in the email sent to the registered email address.</small>
                  </div>

                  {/* CURIOSITY HOOK AS SPECIFIED IN USER PROMPT */}
                  <div className="curiosity-hook-box">
                    <span className="gift-emoji">🎁</span>
                    <h4>A special surprise awaits you after successful disposal!</h4>
                    <p>EcoCredits remain locked until the required live video passes AI verification. No coupons are issued.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="email-modal-footer">
              <button className="close-btn" onClick={() => setShowEmailModal(false)}>
                Close Preview
              </button>
              <button
                className="proceed-scan-btn"
                onClick={() => {
                  setShowEmailModal(false);
                  navigate(`/collection-centre?dispId=${createdDisposal.id}`);
                }}
              >
                Proceed to Collection Centre QR Scan &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DisposalSubmission;
