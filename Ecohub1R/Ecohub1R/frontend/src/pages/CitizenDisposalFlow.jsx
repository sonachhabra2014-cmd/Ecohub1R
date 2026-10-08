import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { apiRequest, getCurrentUser } from '../api';
import NearbyCentersMap from '../NearbyCentersMap';
import { QRCodeSVG } from 'qrcode.react';
import './CitizenDisposalFlow.css';

// Stable per-browser device ID used in capture metadata
function getDeviceId() {
  const key = 'ecohub_capture_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
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

export default function CitizenDisposalFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeUser] = useState(() => getCurrentUser());

  const [currentStep, setCurrentStep] = useState(2);

  const [bagId, setBagId] = useState('');
  const [bagInfo, setBagInfo] = useState(null);
  const [checkingBag, setCheckingBag] = useState(false);

  // Step 1: Product Type
  const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0]);

  // Step 2: Instructions Checklist
  const [instructionsRead, setInstructionsRead] = useState(false);

  // Step 3: Collection Centre
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loadingCentres, setLoadingCentres] = useState(false);

  // Step 4: Product Photo & Details
  const [productPhoto, setProductPhoto] = useState('');
  const [productIdImage, setProductIdImage] = useState('');
  const [productPhotoCaptureMetadata, setProductPhotoCaptureMetadata] = useState(null);
  const [productIdCaptureMetadata, setProductIdCaptureMetadata] = useState(null);
  const [itemName, setItemName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandCode, setBrandCode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [itemCondition, setItemCondition] = useState('Used - Intact with minor scratches');
  const [estimatedWeight, setEstimatedWeight] = useState(2.2);

  // Step 5: User Details
  const [userName, setUserName] = useState(activeUser?.name || '');
  const [userEmail, setUserEmail] = useState(activeUser?.email || '');
  const [userPhone, setUserPhone] = useState('');
  const [userAddress, setUserAddress] = useState('');

  // Step 6: Completed Record
  const [submitting, setSubmitting] = useState(false);
  const [generatedDisposal, setGeneratedDisposal] = useState(null);
  const [submissionError, setSubmissionError] = useState('');

  // QR links carry the bag ID, so resolve its company without an extra scan screen.
  useEffect(() => {
    const qrBagId = new URLSearchParams(location.search).get('bag_id');
    if (qrBagId) {
      setBagId(qrBagId);
      setCheckingBag(true);
      apiRequest(`/api/ecobags/${encodeURIComponent(qrBagId)}`)
        .then((bag) => {
          setBagInfo(bag);
          setBrandCode(bag.brand_code);
          setBrandName(bag.company_name);
        })
        .catch(() => setSubmissionError('This QR code is not linked to a registered company bag.'))
        .finally(() => setCheckingBag(false));
    }

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
  }, [location.search]);

  const fetchCentres = async (lat, lng) => {
    setLoadingCentres(true);
    try {
      const url = lat && lng ? `/api/collection-centres?lat=${lat}&lng=${lng}` : '/api/collection-centres';
      const data = await apiRequest(url);
      if (Array.isArray(data) && data.length > 0) {
        setCentres(data);
        setSelectedCentre(data[0]);
      } else {
        setCentres([]);
        setSelectedCentre(null);
      }
    } catch {
      setCentres([]);
      setSelectedCentre(null);
    } finally {
      setLoadingCentres(false);
    }
  };

  // Handle Photo Upload — sets image DataURL and generates the capture metadata
  // required by the server's validation (capture_method, captured_at, device_id, device_info)
  const handlePhotoUpload = (e, imageSetter, metadataSetter) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Please choose an image smaller than 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert('The selected image could not be read. Please try another file.');
    reader.onload = (uploadEvent) => {
      imageSetter(uploadEvent.target.result);
      metadataSetter({
        capture_method: 'file_upload',
        captured_at: new Date().toISOString(),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        device_id: getDeviceId(),
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // Step 7: Submit to create immutable record
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      setSubmissionError('Name and email address are required.');
      return;
    }
    if (!selectedCentre) {
      setSubmissionError('Please choose an authorized collection centre.');
      return;
    }
    if (!bagInfo) {
      setSubmissionError('Scan and verify a company EcoBag QR code before submitting.');
      return;
    }
    if (!productPhoto) {
      setSubmissionError('Please upload both required product photos before submitting.');
      setCurrentStep(5);
      return;
    }
    if (!productIdImage) {
      setSubmissionError('Please upload the product ID / serial label photo before submitting.');
      setCurrentStep(5);
      return;
    }
    if (!productPhotoCaptureMetadata || !productIdCaptureMetadata) {
      setSubmissionError('Image metadata is missing. Please re-upload both product photos.');
      setCurrentStep(5);
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

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
        capture_method: productPhotoCaptureMetadata.capture_method || 'file_upload',
        capture_metadata: {
          product_photo: productPhotoCaptureMetadata,
          product_id_photo: productIdCaptureMetadata
        },
        collection_centre_id: selectedCentre.id,
        bag_id: bagId,
        user_name: userName.trim(),
        user_email: userEmail.trim().toLowerCase(),
        user_phone: userPhone.trim(),
        user_address: userAddress.trim()
      };

      const res = await apiRequest('/api/disposals/public', 'POST', payload);
      if (res && res.disposal) {
        setGeneratedDisposal(res.disposal);
        setCurrentStep(7);
      } else {
        throw new Error(res?.error || 'Unable to create disposal pass');
      }
    } catch (err) {
      setSubmissionError(err.message || 'Error creating disposal pass.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { number: 1, label: 'Scan Company EcoBag' },
    { number: 2, label: 'Select Product Type' },
    { number: 3, label: 'Disposal Instructions' },
    { number: 4, label: 'Choose Centre' },
    { number: 5, label: 'Product Photo & Details' },
    { number: 6, label: 'Contact & Address' },
    { number: 7, label: 'Disposal ID Generated' }
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
              {stepsList[currentStep - 1]?.label}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
              {Math.round((currentStep / 7) * 100)}% Completed
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
        {/* STEP 1: LINK COMPANY ECOBAG */}
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
                Identification
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0.35rem 0' }}>
                Link Your Company EcoBag
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
                Scan the company EcoBag QR code with your phone to open this page, or paste its link or bag ID below. The bag must be registered to a company.
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                {bagInfo ? `Linked company: ${bagInfo.company_name} · EcoBag ${bagInfo.bag_id}` : 'No company bag linked yet'}
              </div>
            </div>

            <div id="ecohub-qr-reader" style={{ maxWidth: '360px', margin: '0 auto 1rem' }} />
            <button
              type="button"
              onClick={() => setCameraActive(true)}
              disabled={cameraActive || checkingBag}
              style={{ marginBottom: '1rem', background: '#0F9D58', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.7rem 1rem', fontWeight: '700' }}
            >
              {cameraActive ? 'Opening camera...' : 'Scan EcoBag with Camera'}
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#334155', marginBottom: '0.4rem' }}>
                Company EcoBag QR link or bag ID:
              </label>
              <input
                type="text"
                placeholder="Paste the EcoBag link or enter its bag ID"
                value={scannedProductQR}
                onChange={(e) => setScannedProductQR(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontFamily: 'monospace'
                }}
              />
              {qrStatusMessage && (
                <div style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: '600', marginTop: '0.4rem' }}>
                  {qrStatusMessage}
                </div>
              )}
              <button
                type="button"
                onClick={handleValidateBag}
                disabled={checkingBag || !scannedProductQR.trim()}
                style={{ marginTop: '0.75rem', background: '#e6f4ea', color: '#166534', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 0.9rem', fontWeight: '700' }}
              >
                {checkingBag ? 'Checking EcoBag...' : 'Verify EcoBag'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                disabled={!bagInfo || checkingBag}
                onClick={() => setCurrentStep(2)}
                style={{
                  backgroundColor: bagInfo && !checkingBag ? '#0F9D58' : '#94a3b8',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.95rem',
                  cursor: bagInfo && !checkingBag ? 'pointer' : 'not-allowed'
                }}
              >
                Continue to Product Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: SELECT PRODUCT TYPE */}
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
                      setItemName(cat.name);
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
                onClick={() => setCurrentStep(3)}
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
                disabled={!instructionsRead}
                onClick={() => setCurrentStep(4)}
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
            ) : centres.length === 0 ? (
              <div style={{ padding: '1.5rem', marginBottom: '1.5rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', color: '#9a3412' }}>
                No active collection centres are available right now. Please try again later.
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
                disabled={!selectedCentre}
                onClick={() => setCurrentStep(5)}
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
        {currentStep === 5 && (
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
                Attach a clear photograph of your equipment and enter the hardware specifications.
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
                  {productPhoto ? (
                    <div>
                      <img src={productPhoto} alt="Product Upload" style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px' }} />
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setProductPhoto('')}
                          style={{ fontSize: '0.78rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                        >
                          Remove Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>📸</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Click to capture or upload product photo</div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handlePhotoUpload(e, setProductPhoto, setProductPhotoCaptureMetadata)}
                        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  )}
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
                  {productIdImage ? (
                    <div>
                      <img src={productIdImage} alt="Serial Badge" style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px' }} />
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setProductIdImage('')}
                          style={{ fontSize: '0.78rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                        >
                          Remove Badge Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>🏷️</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Upload sticker, barcode, or IMEI badge</div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handlePhotoUpload(e, setProductIdImage, setProductIdCaptureMetadata)}
                        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  )}
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
                type="button"
                onClick={() => setCurrentStep(6)}
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
                Proceed to User Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6: ENTER NAME, CONTACT & ADDRESS */}
        {/* ========================================================================= */}
        {currentStep === 6 && (
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
                onClick={() => setCurrentStep(5)}
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
        {currentStep === 7 && generatedDisposal && (
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
                Disposal ID &amp; QR Pass Generated!
              </h2>
              <p style={{ color: '#475569', margin: '0 0 1rem' }}>
                Your pass has been emailed to <strong>{generatedDisposal.user_email}</strong>. The selected collection centre must verify the handover.
              </p>
              
              {/* EXACT STATUS AS REQUIRED */}
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

            {/* OFFICIAL PASS CARD */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1.75rem',
              backgroundColor: '#f8fafc',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              alignItems: 'center'
            }}>
              {/* QR CODE & DISPOSAL ID */}
              <div style={{ textAlign: 'center', borderRight: '1px dashed #cbd5e1', paddingRight: '1rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Unique Disposal Identifier
                </div>
                <div style={{
                  fontSize: '1.45rem',
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  color: '#0F9D58',
                  letterSpacing: '0.05em',
                  marginBottom: '1rem'
                }}>
                  {generatedDisposal.id}
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                  borderRadius: '10px',
                  display: 'inline-block',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                }}>
                  <QRCodeSVG
                    value={generatedDisposal.qr_data || generatedDisposal.id}
                    size={170}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                  Present this QR code at the intake desk
                </div>
              </div>

              {/* LINKED METADATA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                    1. Registered User
                  </span>
                  <strong style={{ color: '#0f172a' }}>{generatedDisposal.user_name}</strong> &bull; {generatedDisposal.user_email}
                  {generatedDisposal.user_address && (
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>{generatedDisposal.user_address}</div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                    2. Product Hardware
                  </span>
                  <strong style={{ color: '#0f172a' }}>{generatedDisposal.item_name}</strong> ({generatedDisposal.category})
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Brand: {generatedDisposal.brand_name} &bull; Approx. {generatedDisposal.estimated_weight_kg} kg
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                    3. Selected Collection Centre
                  </span>
                  <strong style={{ color: '#0284c7' }}>{generatedDisposal.collection_centre_name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>{generatedDisposal.collection_centre_address}</div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Registration Timestamp: {new Date().toLocaleString()} &bull; Bound to Authorized Verification Terminal
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: '700',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                🖨️ Print Disposal Pass
              </button>

              <button
                type="button"
                onClick={() => navigate(`/centre/dashboard?dispId=${generatedDisposal.id}`)}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                🏢 Open Collection Centre Terminal →
              </button>

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
