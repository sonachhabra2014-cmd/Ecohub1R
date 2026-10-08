import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../api';
import NearbyCentersMap from '../NearbyCentersMap';
import { Html5Qrcode } from 'html5-qrcode';
import LiveCameraCapture from '../components/LiveCameraCapture';
import './CitizenDisposalFlow.css';
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

// A base64 data URL (what the live camera / file reader produce).
function isDataImage(image) {
  if (typeof image !== 'string') return false;
  const value = image.trim();
  return /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,[A-Za-z0-9+/=\s]+$/i.test(value);
}

// Previously stored asset reference (remote URL or /uploads path).
function isStoredImagePath(image) {
  if (typeof image !== 'string') return false;
  return /^(https?:\/\/|\/uploads\/|\/images\/)/i.test(image.trim());
}

// Any value the platform accepts as photographic evidence.
function isEvidenceImage(image) {
  return isDataImage(image) || isStoredImagePath(image);
}

const PRODUCT_CATEGORIES = [
  { id: 'Laptop', name: 'Laptops & Computers', icon: '💻', defaultWeight: 2.2, defaultBrand: 'dell', brandName: 'Dell Technologies' },
  { id: 'Mobile', name: 'Smartphones & Mobile Devices', icon: '📱', defaultWeight: 0.22, defaultBrand: 'samsung', brandName: 'Samsung Electronics' },
  { id: 'Monitor', name: 'Monitors & Displays', icon: '🖥️', defaultWeight: 4.5, defaultBrand: 'dell', brandName: 'Dell Technologies' },
  { id: 'Battery', name: 'Batteries & Power Packs', icon: '🔋', defaultWeight: 0.45, defaultBrand: 'samsung', brandName: 'Samsung Electronics' },
  { id: 'Charger', name: 'Chargers, Cables & Peripherals', icon: '🔌', defaultWeight: 0.15, defaultBrand: 'apple', brandName: 'Apple Inc.' },
  { id: 'Other', name: 'Appliances & Other Electronics', icon: '📦', defaultWeight: 1.5, defaultBrand: 'hp', brandName: 'HP Inc.' }
];

const DISPOSAL_INSTRUCTIONS = {
  Laptop: [
    'Perform complete factory reset and backup all personal data to cloud/external storage.',
    'Remove all accessories, dongles, and external storage drives.',
    'Inspect battery compartment: If casing is bulging, seal in an insulated bag immediately.',
    'Do not crush or puncture internal components. Keep screws intact.'
  ],
  Mobile: [
    'Eject physical SIM card and any micro-SD external memory cards.',
    'Sign out of Google/Apple ID and execute full factory reset wipe.',
    'Verify that the device battery is not swollen, leaking, or damaged.',
    'Keep charging port clean and do not attempt to dismantle screen.'
  ],
  Monitor: [
    'Disconnect power cables, HDMI/DisplayPort wires, and mounting brackets.',
    'Handle screen with care to prevent breakage of fluorescent backlights or LED layers.',
    'Do not puncture display panel glass or bend the chassis.',
    'Wrap glass panel in protective cardboard or bubble packaging for transit.'
  ],
  Battery: [
    'CRITICAL SAFETY: Never puncture, crush, incinerate, or expose batteries to liquids.',
    'Insulate exposed electrical terminals with non-conductive electrical tape.',
    'Store separately from loose metal coins, keys, or screws to prevent short circuits.',
    'Transport upright in a non-conductive fire-resistant pouch or plastic container.'
  ],
  Charger: [
    'Coil cables gently without tight kinks, acute bends, or knots.',
    'Keep frayed, bare copper wires safely insulated.',
    'Separate plastic adapters from copper cords where modular.'
  ],
  Other: [
    'Power off the unit and unplug completely from wall voltage.',
    'Remove any AA/AAA, lead-acid, or lithium battery cells from internal bays.',
    'Ensure all loose panels, trays, or cords are secured for transit.'
  ]
};

const SAMPLE_PRODUCT_QRS = [
  { name: 'Dell Latitude 7420 Laptop', category: 'Laptop', brand: 'dell', brandName: 'Dell Technologies', code: 'PROD:DELL:LATITUDE-7420:SN-DL88921X' },
  { name: 'Samsung Galaxy S22 Ultra', category: 'Mobile', brand: 'samsung', brandName: 'Samsung Electronics', code: 'PROD:SAMSUNG:GALAXY-S22:IMEI-358921098' },
  { name: 'Apple MacBook Pro 14"', category: 'Laptop', brand: 'apple', brandName: 'Apple Inc.', code: 'PROD:APPLE:MBP-14-M2:SER-C02GF92XMD' },
  { name: 'HP Color LaserJet Printer', category: 'Other', brand: 'hp', brandName: 'HP Inc.', code: 'PROD:HP:LASERJET-M479:SER-VNC89012' },
  { name: 'Samsung 45W Fast Battery Unit', category: 'Battery', brand: 'samsung', brandName: 'Samsung Electronics', code: 'PROD:SAMSUNG:BATT-45W-ION:SER-EB-P5300' }
];

const FALLBACK_CENTRES = [
  { id: 1, name: 'Green Hub Delhi Central', address: 'Connaught Place, New Delhi', latitude: 28.6315, longitude: 77.2167, distance_km: 1.2, license_no: 'ECO-DEL-001' },
  { id: 2, name: 'Eco Center Noida Hub', address: 'Sector 62, Noida, Uttar Pradesh', latitude: 28.6277, longitude: 77.3648, distance_km: 12.4, license_no: 'ECO-NOI-002' },
  { id: 3, name: 'EcoHub South Delhi Facility', address: 'Nehru Place, New Delhi', latitude: 28.5494, longitude: 77.2536, distance_km: 8.6, license_no: 'ECO-DEL-003' }
];

export default function CitizenDisposalFlow() {
  const navigate = useNavigate();

  // Workflow Steps:
  // Step 1: Select Product Type
  // Step 2: Product-Specific Disposal Instructions
  // Step 3: Choose Collection Centre
  // Step 4: Upload Product Photo & Product Details
  // Step 5: Enter Name, Contact & Address
  // Step 6: Disposal ID & QR Pass Generation (Status: "Awaiting Collection Centre Verification")
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Product QR Scanner
  const [scannedProductQR, setScannedProductQR] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [qrStatusMessage, setQrStatusMessage] = useState('');

  // Step 2: Product Type
  const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0]);

  // Step 3: Instructions Checklist
  const [instructionsRead, setInstructionsRead] = useState(false);

  // Step 4: Collection Centre
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loadingCentres, setLoadingCentres] = useState(false);

  // Step 5: Product Photo & Details
  const [productPhoto, setProductPhoto] = useState('');
  const [productIdImage, setProductIdImage] = useState('');
  const [productCaptureMetadata, setProductCaptureMetadata] = useState(null);
  const [productIdCaptureMetadata, setProductIdCaptureMetadata] = useState(null);
  const [itemName, setItemName] = useState('Dell Latitude 7420 Laptop');
  const [brandName, setBrandName] = useState('Dell Technologies');
  const [brandCode, setBrandCode] = useState('dell');
  const [serialNumber, setSerialNumber] = useState('SN-DL88921X');
  const [itemCondition, setItemCondition] = useState('Used - Intact with minor scratches');
  const [estimatedWeight, setEstimatedWeight] = useState(2.2);

  // Step 6: User Details
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userAddress, setUserAddress] = useState('');

  // Step 7: Completed Record
  const [submitting, setSubmitting] = useState(false);
  const [generatedDisposal, setGeneratedDisposal] = useState(null);
  const [submissionError, setSubmissionError] = useState('');

  // Load centres on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          fetchCentres(loc.lat, loc.lng);
        },
        () => {
          fetchCentres();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fetchCentres();
    }
  }, []);

  const fetchCentres = async (lat, lng) => {
    setLoadingCentres(true);
    try {
      const url = lat && lng ? `/api/collection-centres?lat=${lat}&lng=${lng}` : '/api/collection-centres';
      const data = await apiRequest(url);
      if (Array.isArray(data) && data.length > 0) {
        setCentres(data);
        setSelectedCentre(data[0]);
      } else {
        setCentres(FALLBACK_CENTRES);
        setSelectedCentre(FALLBACK_CENTRES[0]);
      }
    } catch {
      setCentres(FALLBACK_CENTRES);
      setSelectedCentre(FALLBACK_CENTRES[0]);
    } finally {
      setLoadingCentres(false);
    }
  };

  // Step 1: Quick Sample Scan Handler
  const handleApplySampleQR = (sample) => {
    setScannedProductQR(sample.code);
    setItemName(sample.name);
    setBrandName(sample.brandName);
    setBrandCode(sample.brand);
    setSerialNumber(sample.code.split(':').pop() || 'SN-UNKNOWN');

    const matchedCat = PRODUCT_CATEGORIES.find(c => c.id === sample.category);
    if (matchedCat) {
      setSelectedCategory(matchedCat);
      setEstimatedWeight(matchedCat.defaultWeight);
    }

    setQrStatusMessage(`✓ Product Identified: ${sample.name} (${sample.brandName})`);
  };

  // Step 7: Submit to create immutable record
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!isEvidenceImage(productPhoto) || !isEvidenceImage(productIdImage)) {
      const missing = [];
      if (!isEvidenceImage(productPhoto)) missing.push('product photo');
      if (!isEvidenceImage(productIdImage)) missing.push('serial-label or product-ID image');
      setSubmissionError(`Add a valid ${missing.join(' and ')} before submitting.`);
      setCurrentStep(4);
      return;
    }
    if (!userName.trim() || !userEmail.trim()) {
      setSubmissionError('Name and email address are required.');
      return;
    }
    if (!selectedCentre) {
      setSubmissionError('Please choose an authorized collection centre.');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

    debugLog('submitting disposal', {
      hasProductPhoto: Boolean(productPhoto),
      productPhotoPrefix: String(productPhoto).slice(0, 32),
      hasProductIdImage: Boolean(productIdImage),
      productIdImagePrefix: String(productIdImage).slice(0, 32),
      productMeta: productCaptureMetadata,
      idMeta: productIdCaptureMetadata,
      centreId: selectedCentre?.id
    });

    const defaultMeta = {
      capture_method: 'file_upload',
      captured_at: new Date().toISOString(),
      device_id: 'ecohub_browser_submission',
      device_info: { user_agent: navigator.userAgent }
    };

    try {
      const payload = {
        item_name: itemName || `${selectedCategory.name}`,
        category: selectedCategory.id,
        brand_code: brandCode || 'generic',
        brand_name: brandName || 'Certified Partner',
        serial_number: serialNumber || '',
        item_condition: itemCondition,
        estimated_weight_kg: parseFloat(estimatedWeight) || selectedCategory.defaultWeight,
        product_photo: productPhoto,
        product_id_image: productIdImage,
        photo_url: productPhoto,
        capture_method: (productCaptureMetadata?.capture_method === 'live_camera' || productIdCaptureMetadata?.capture_method === 'live_camera') ? 'live_camera' : 'file_upload',
        capture_metadata: {
          product_photo: productCaptureMetadata || defaultMeta,
          product_id_photo: productIdCaptureMetadata || defaultMeta
        },
        collection_centre_id: selectedCentre.id,
        user_name: userName.trim(),
        user_email: userEmail.trim().toLowerCase(),
        user_phone: userPhone.trim(),
        user_address: userAddress.trim()
      };

      debugLog('POST /api/disposals/public payload', {
        item_name: payload.item_name,
        category: payload.category,
        capture_method: payload.capture_method,
        collection_centre_id: payload.collection_centre_id,
        product_photo: { present: Boolean(payload.product_photo), prefix: String(payload.product_photo).slice(0, 32) },
        product_id_image: { present: Boolean(payload.product_id_image), prefix: String(payload.product_id_image).slice(0, 32) }
      });

      const res = await apiRequest('/api/disposals/public', 'POST', payload);
      if (res && res.disposal) {
        setGeneratedDisposal(res.disposal);
        setCurrentStep(6);
      } else {
        throw new Error(res?.error || 'Unable to create disposal pass');
      }
    } catch (err) {
      debugLog('disposal submission failed', { message: err.message });
      setSubmissionError(err.message || 'Error creating disposal pass.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { number: 1, label: 'Select Product Type' },
    { number: 2, label: 'Disposal Instructions' },
    { number: 3, label: 'Choose Centre' },
    { number: 4, label: 'Product Photo & Details' },
    { number: 5, label: 'Contact & Address' },
    { number: 6, label: 'Disposal ID Generated' }
  ];

  return (
    <div style={{ minHeight: '92vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
        
        {/* PLATFORM TAGLINE BAR */}
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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0F9D58' }} />
            <strong style={{ color: '#0F9D58' }}>STAGE 1: USER ENGAGEMENT &amp; ID GENERATION</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: '700' }}>
            One Platform • One Record • Complete Waste Journey Visibility
          </div>
        </div>

        {/* STEP PROGRESS BAR */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>
              Step {currentStep} of 6: {stepsList[currentStep - 1]?.label}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
              {Math.round((currentStep / 6) * 100)}% Completed
            </span>
          </div>
          
          {/* Visual Step Dots */}
          <div style={{ display: 'flex', gap: '0.4rem', height: '6px' }}>
            {stepsList.map((s) => (
              <div
                key={s.number}
                style={{
                  flex: 1,
                  height: '100%',
                  borderRadius: '3px',
                  backgroundColor: s.number <= currentStep ? '#0F9D58' : '#e2e8f0',
                  transition: 'background-color 0.2s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 2: SELECT PRODUCT TYPE */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="flow-card-white" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                Classification
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Select the Product Type
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                Identify the equipment category to apply certified safety protocols and verify recycling criteria.
              </p>
            </div>

            {/* PRODUCT CATEGORIES GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {PRODUCT_CATEGORIES.map((cat) => {
                const selected = selectedCategory.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setEstimatedWeight(cat.defaultWeight);
                      setBrandCode(cat.defaultBrand);
                      setBrandName(cat.brandName);
                    }}
                    style={{
                      background: selected ? '#e6f4ea' : '#ffffff',
                      border: selected ? '2px solid #0F9D58' : '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '1.25rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>{cat.icon}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '800', color: selected ? '#0F9D58' : '#0f172a', marginBottom: '0.25rem' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Avg. {cat.defaultWeight} kg
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{
                  backgroundColor: '#0F9D58',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                View Safety Instructions &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: PRODUCT-SPECIFIC DISPOSAL INSTRUCTIONS */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="flow-card-white" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                Safety Protocol
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Product-Specific Disposal Instructions
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                Please review these certified handling requirements for <strong>{selectedCategory.name}</strong> before handover.
              </p>
            </div>

            {/* INSTRUCTIONS BOX */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{selectedCategory.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>
                    {selectedCategory.name} Protocol
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#0F9D58', fontWeight: '600' }}>
                    Certified CPCB / EPR Guidelines
                  </span>
                </div>
              </div>

              <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', fontSize: '0.92rem', lineHeight: '1.7' }}>
                {(DISPOSAL_INSTRUCTIONS[selectedCategory.id] || DISPOSAL_INSTRUCTIONS.Other).map((instruction, idx) => (
                  <li key={idx} style={{ marginBottom: '0.5rem' }}>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>

            {/* ACKNOWLEDGEMENT CHECKBOX */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: '#e6f4ea',
              border: '1px solid #bbf7d0',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}>
              <input
                type="checkbox"
                checked={instructionsRead}
                onChange={(e) => setInstructionsRead(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#0F9D58' }}
              />
              <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#166534' }}>
                I confirm that I have reviewed the safety instructions, wiped personal data, and secured the hardware.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={!instructionsRead}
                onClick={() => setCurrentStep(3)}
                style={{
                  backgroundColor: instructionsRead ? '#0F9D58' : '#94a3b8',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.95rem',
                  cursor: instructionsRead ? 'pointer' : 'not-allowed'
                }}
              >
                Choose Collection Centre &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: CHOOSE NEARBY COLLECTION CENTRE */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="flow-card-white" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                Drop-Off Location
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Choose an Authorized Collection Centre
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                Select an approved facility where your item will be physically received, inspected, and verified into the official registry.
              </p>
            </div>

            {loadingCentres ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Loading verified collection centres...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {centres.map((centre) => {
                  const isSelected = selectedCentre?.id === centre.id;
                  return (
                    <div
                      key={centre.id}
                      onClick={() => setSelectedCentre(centre)}
                      style={{
                        background: isSelected ? '#e6f4ea' : '#ffffff',
                        border: isSelected ? '2px solid #0F9D58' : '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🏢</span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#0F9D58' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#475569'
                        }}>
                          {isSelected ? 'SELECTED' : 'SELECT'}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>
                        {centre.name}
                      </h4>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: '#64748b' }}>
                        {centre.address}
                      </p>
                      <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: '600' }}>
                        License: {centre.license_no || `CPCB-REG-00${centre.id}`}
                      </div>
                      {centre.distance_km !== undefined && (
                        <div style={{ fontSize: '0.78rem', color: '#0F9D58', fontWeight: '700', marginTop: '0.25rem' }}>
                          📍 Approx. {centre.distance_km} km away &bull; Open 9 AM - 6 PM
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={!selectedCentre}
                onClick={() => setCurrentStep(4)}
                style={{
                  backgroundColor: '#0F9D58',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.95rem',
                  cursor: selectedCentre ? 'pointer' : 'not-allowed'
                }}
              >
                Proceed to Upload Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: UPLOAD PRODUCT PHOTO & DETAILS */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="flow-card-white" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                Evidence &amp; Specifications
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Upload Product Photo &amp; Details
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                Upload clear images of your equipment and its serial label, or capture them with your camera.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Photo Upload 1: Product Photo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#334155', marginBottom: '0.4rem' }}>
                  1. Product Photograph:
                </label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer'
                }}>
                  <LiveCameraCapture
                    value={productPhoto}
                    onCapture={(image, metadata) => {
                      debugLog('product photo captured', { prefix: String(image).slice(0, 32), capture_method: metadata?.capture_method });
                      setProductPhoto(image);
                      setProductCaptureMetadata(metadata);
                    }}
                    altText="Product photo captured live"
                  />
                </div>
              </div>

              {/* Photo Upload 2: Product ID / Barcode Image */}
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#334155', marginBottom: '0.4rem' }}>
                  2. Product ID / Serial Label Photo *:
                </label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer'
                }}>
                  <LiveCameraCapture
                    value={productIdImage}
                    onCapture={(image, metadata) => {
                      debugLog('product ID image captured', { prefix: String(image).slice(0, 32), capture_method: metadata?.capture_method });
                      setProductIdImage(image);
                      setProductIdCaptureMetadata(metadata);
                    }}
                    altText="Product serial label captured live"
                  />
                </div>
              </div>
            </div>

            {/* PRODUCT SPECIFICATION FIELDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Item / Model Name:
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Galaxy S22 or ThinkPad X1"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Manufacturer / Brand:
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Dell, Samsung, HP"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Serial / IMEI / Tag:
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-882910X"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Estimated Weight (kg):
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={estimatedWeight}
                  onChange={(e) => setEstimatedWeight(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                Physical Condition:
              </label>
              <input
                type="text"
                value={itemCondition}
                onChange={(e) => setItemCondition(e.target.value)}
                placeholder="e.g. Working condition, cracked screen, battery intact"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                disabled={!isEvidenceImage(productPhoto) || !isEvidenceImage(productIdImage)}
                style={{
                  backgroundColor: isEvidenceImage(productPhoto) && isEvidenceImage(productIdImage) ? '#0F9D58' : '#94a3b8',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.95rem',
                  cursor: isEvidenceImage(productPhoto) && isEvidenceImage(productIdImage) ? 'pointer' : 'not-allowed'
                }}
              >
                Proceed to User Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6: ENTER NAME, CONTACT & ADDRESS */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <form onSubmit={handleFinalSubmit} className="flow-card-white" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0F9D58', textTransform: 'uppercase' }}>
                Citizen Identification
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Enter Name, Contact Details &amp; Address
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                This record will be cryptographically bound to you, your hardware, and the selected collection centre.
              </p>
            </div>

            {submissionError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '1rem'
              }}>
                {submissionError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arun Sharma"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Email Address * (For Disposal Pass Delivery)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. arun.sharma@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Residential Address (City, Pincode) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Green Park, New Delhi - 110016"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* SUMMARY CARD OF LINKED RECORD */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '0.4rem' }}>
                🔗 EcoHub Tripartite Record Binding Summary:
              </div>
              <div style={{ color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>• <strong>Product:</strong> {itemName} ({selectedCategory.name}) &bull; {estimatedWeight} kg</div>
                <div>• <strong>Selected Collection Centre:</strong> {selectedCentre?.name} ({selectedCentre?.address})</div>
                <div>• <strong>Custodian User:</strong> {userName || '[Entered Name]'} &bull; {userEmail || '[Entered Email]'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                &larr; Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: '#0F9D58',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.85rem 2rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '1rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px rgba(15, 157, 88, 0.25)'
                }}
              >
                {submitting ? 'Generating Cryptographic Pass...' : 'Generate Disposal ID & Pass →'}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 7: DISPOSAL ID & QR PASS GENERATION */}
        {/* ========================================================================= */}
        {currentStep === 6 && generatedDisposal && (
          <div className="flow-card-white" style={{
            background: '#ffffff',
            border: '2px solid #0F9D58',
            borderRadius: '12px',
            padding: '2.5rem 2rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)'
          }}>
            {/* SUCCESS BANNER */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontSize: '2rem',
                marginBottom: '0.75rem'
              }}>
                ✓
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Disposal Pass Sent to Your Email
              </h2>

              <div style={{
                display: 'inline-block',
                backgroundColor: '#e0f2fe',
                border: '1px solid #0284c7',
                color: '#0369a1',
                padding: '0.5rem 1.25rem',
                borderRadius: '999px',
                fontWeight: '800',
                fontSize: '0.95rem'
              }}>
                Status: Awaiting Collection Centre Verification
              </div>
            </div>

            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1.75rem',
              backgroundColor: '#f8fafc',
              marginBottom: '2rem',
              color: '#334155',
              lineHeight: '1.8',
              fontSize: '0.96rem'
            }}>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Your disposal pass and QR code have been emailed to <strong>{generatedDisposal.user_email}</strong>.
              </p>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Please visit the selected collection centre and show the QR code and disposal ID from your email to the staff.
              </p>
              <p style={{ margin: 0 }}>
                The collection centre will verify the pass after logging into their profile and validating the record.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  setGeneratedDisposal(null);
                }}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '600',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                + Register Another Device
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
