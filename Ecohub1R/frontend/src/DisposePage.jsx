import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NearbyCentersMap from "./NearbyCentersMap";
import { apiRequest } from "./api";
import "./DisposePage.css";

function DisposePage() {
  const locationHook = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(locationHook.search);
  const bagParam = queryParams.get("bag_id") || "BAG-SAMSUNG-2026-001";
  const companyParam = queryParams.get("company") || "samsung";

  // Form States
  const [bagId, setBagId] = useState(bagParam);
  const [brandCode, setBrandCode] = useState(companyParam);
  const [brandName, setBrandName] = useState("Samsung Electronics");
  const [selectedItem, setSelectedItem] = useState("Mobile Phone");
  const [itemCondition, setItemCondition] = useState("Used - Working/Faulty Screen");
  const [estimatedWeight, setEstimatedWeight] = useState(0.25);

  // User Contact Details
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  // GPS & Centre States
  const [location, setLocation] = useState({ lat: 28.6315, lng: 77.2167, accuracy: 12, source: "GPS Satellite" });
  const [locationStatus, setLocationStatus] = useState("success"); // idle | detecting | success | denied
  const [centers, setCenters] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [radiusFilter, setRadiusFilter] = useState("all");

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [createdDisposal, setCreatedDisposal] = useState(null);
  const [checklistConfirmed, setChecklistConfirmed] = useState({
    dataWiped: true,
    batterySafe: true,
    packedInBag: true
  });

  const items = [
    { name: "Mobile Phone", icon: "📱", weight: 0.22, category: "Mobile Devices" },
    { name: "Laptop", icon: "💻", weight: 2.10, category: "Computing" },
    { name: "Battery", icon: "🔋", weight: 0.35, category: "Batteries" },
    { name: "Charging Cable", icon: "🔌", weight: 0.08, category: "Accessories" },
    { name: "Earphones", icon: "🎧", weight: 0.05, category: "Audio" },
    { name: "Monitor", icon: "🖥️", weight: 4.80, category: "Displays" },
    { name: "Keyboard & Mouse", icon: "⌨️", weight: 0.65, category: "Peripherals" },
    { name: "Printer", icon: "🖨️", weight: 5.50, category: "Appliances" }
  ];

  const mandatoryInstructions = {
    "Mobile Phone": [
      "Remove personal SIM card and external memory card.",
      "Back up important files and perform a factory reset to wipe personal data.",
      "Inspect battery for swelling or damage.",
      "Place securely into a protective bag."
    ],
    Laptop: [
      "Back up confidential data and sign out of all cloud accounts.",
      "Disconnect detachable charging adapter and external mouse.",
      "Ensure chassis screws and casing are intact.",
      "Carefully fold and slide into a padded bag."
    ],
    Battery: [
      "Do NOT puncture, crush, or expose the battery to fire or moisture.",
      "Insulate terminals with non-conductive electrical tape if exposed.",
      "Keep separated from loose metallic items.",
      "Store upright in a protective pouch."
    ],
    "Charging Cable": [
      "Bundle cables neatly into coils without sharp kinks.",
      "Separate frayed or exposed copper wires."
    ],
    Earphones: [
      "Clean ear tips if reusable or detach rubber tips.",
      "Wind cord neatly to avoid knotting."
    ],
    Monitor: [
      "Disconnect power cable and display cables.",
      "Protect glass screen surface from direct impacts."
    ],
    "Keyboard & Mouse": [
      "Remove alkaline/rechargeable batteries from wireless units.",
      "Clean surface debris before packaging."
    ],
    Printer: [
      "Remove ink or toner cartridges before drop-off.",
      "Secure moving paper trays with tape."
    ]
  };

  const presetLocations = [
    { name: "Connaught Place, Delhi", lat: 28.6315, lng: 77.2167 },
    { name: "Sector 62, Noida", lat: 28.6277, lng: 77.3648 },
    { name: "Nehru Place, South Delhi", lat: 28.5494, lng: 77.2536 },
    { name: "DLF Cyber City, Gurugram", lat: 28.4952, lng: 77.0894 },
    { name: "BKC, Mumbai", lat: 19.0688, lng: 72.8698 },
    { name: "Electronic City, Bengaluru", lat: 12.8452, lng: 77.6602 }
  ];

  useEffect(() => {
    // Resolve Brand Name from query or default
    const brandMap = {
      samsung: "Samsung Electronics",
      hp: "HP Inc.",
      dell: "Dell Technologies",
      lenovo: "Lenovo Group",
      apple: "Apple Inc.",
      sony: "Sony Corporation"
    };
    if (brandMap[companyParam.toLowerCase()]) {
      setBrandName(brandMap[companyParam.toLowerCase()]);
    }
    fetchNearbyCenters(location);
  }, [companyParam]);

  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  const fetchNearbyCenters = async (coords) => {
    setLoadingCenters(true);
    try {
      let url = "/api/collection-centres";
      if (coords) {
        url += `?lat=${coords.lat}&lng=${coords.lng}`;
      }
      const data = await apiRequest(url);
      if (Array.isArray(data) && data.length > 0) {
        let list = data;
        if (coords && list[0].distance_km === undefined) {
          list = list.map((c) => ({
            ...c,
            distance_km: calculateDistanceKm(coords.lat, coords.lng, c.latitude, c.longitude)
          }));
          list.sort((a, b) => a.distance_km - b.distance_km);
          list[0].is_nearest = true;
        }
        setCenters(list);
        if (!selectedCenter) setSelectedCenter(list[0]);
      }
    } catch (err) {
      console.warn("Using fallback centres:", err);
      const fallbackList = [
        { id: 1, name: "Green Hub Delhi Central", address: "Connaught Place, New Delhi", latitude: 28.6315, longitude: 77.2167, distance_km: 0.42, is_nearest: true },
        { id: 2, name: "Eco Center Noida", address: "Sector 62, Noida, Uttar Pradesh", latitude: 28.6277, longitude: 77.3648, distance_km: 14.8 },
        { id: 3, name: "EcoHub South Delhi Facility", address: "Nehru Place, New Delhi", latitude: 28.5494, longitude: 77.2536, distance_km: 9.1 }
      ];
      setCenters(fallbackList);
      if (!selectedCenter) setSelectedCenter(fallbackList[0]);
    } finally {
      setLoadingCenters(false);
    }
  };

  const detectLiveGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          source: "Live GPS"
        };
        setLocation(coords);
        setLocationStatus("success");
        fetchNearbyCenters(coords);
      },
      (err) => {
        console.warn("GPS error:", err);
        setLocationStatus("denied");
        alert("Could not access live GPS. Please select a city preset below.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectItem = (itemObj) => {
    setSelectedItem(itemObj.name);
    setEstimatedWeight(itemObj.weight);
  };

  const handleSubmitDisposal = async (e) => {
    e.preventDefault();

    if (!userEmail.trim()) {
      alert("Please enter your email address so we can dispatch your Disposal ID and Award Pass!");
      return;
    }
    if (!selectedCenter) {
      alert("Please choose an authorized collection centre.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        bag_id: bagId,
        brand_code: brandCode,
        brand_name: brandName,
        item_name: selectedItem,
        category: items.find((i) => i.name === selectedItem)?.category || "Electronics",
        item_condition: itemCondition,
        estimated_weight_kg: parseFloat(estimatedWeight),
        collection_centre_id: selectedCenter.id,
        user_email: userEmail.trim().toLowerCase(),
        user_name: userName.trim() || "Eco Contributor",
        user_phone: userPhone.trim(),
        appointment_time: "Today / Tomorrow (9:00 AM – 6:00 PM)"
      };

      const res = await apiRequest("/api/disposals/public", "POST", payload);

      if (res && res.disposal) {
        setCreatedDisposal(res.disposal);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Submission failed:", err);
      alert(err.message || "Failed to submit disposal request.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ========================================================
     SCREEN 2: CONFIRMED DISPOSAL PASS (AFTER EMAIL #1 SENT)
     ======================================================== */
  if (createdDisposal) {
    return (
      <div className="dispose-page-root">
        <div className="disposal-confirmed-container">
          <div className="confirmed-header-card">
            <div className="confirmed-badge">STEP 1 COMPLETE &bull; DISPOSAL PASS DISPATCHED</div>
            <h1 className="confirmed-title">🎉 Disposal Pass Created & Sent to Your Email!</h1>
            <p className="confirmed-subtitle">
              We have dispatched your appointment confirmation and verification QR pass to <strong>{createdDisposal.user_email}</strong>.
            </p>
          </div>

          {/* EXCITING AWARD TEASER BANNER */}
          <div className="award-teaser-box">
            <div className="award-teaser-icon">🎁</div>
            <div className="award-teaser-text">
              <h2>An Award Awaits You!</h2>
              <p>
                Take your e-waste item to your selected collection centre. As soon as the authorized collection officer scans your QR pass, your e-waste will be certified and your <strong>EcoCredits</strong> will be revealed!
              </p>
            </div>
          </div>

          {/* DIGITAL QR PASS CARD */}
          <div className="qr-pass-card">
            <div className="pass-meta-header">
              <div>
                <span className="pass-brand-tag">{createdDisposal.brand_name?.toUpperCase()} VERIFIED</span>
                <h3 className="pass-item-title">{createdDisposal.item_name}</h3>
                <span className="pass-bag-id">ID: {createdDisposal.bag_id || bagId}</span>
              </div>
              <div className="pass-id-pill">
                <span className="id-label">DISPOSAL ID</span>
                <span className="id-val">{createdDisposal.id}</span>
              </div>
            </div>

            {/* QR CODE DISPLAY */}
            <div className="pass-qr-render-area">
              <div className="qr-instructions">
                <strong>Your QR pass was sent by email</strong>
                <span>Show the QR code from your email at the selected collection centre.</span>
              </div>
            </div>

            {/* DROP-OFF CENTRE DETAILS */}
            <div className="pass-centre-info">
              <div className="info-row">
                <span className="info-icon">📍</span>
                <div>
                  <strong>Drop-off Facility:</strong> {createdDisposal.collection_centre_name}
                  <div className="sub-addr">{createdDisposal.collection_centre_address}</div>
                </div>
              </div>
              <div className="info-row">
                <span className="info-icon">🕒</span>
                <div>
                  <strong>Operating Hours:</strong> Monday – Saturday (9:00 AM – 6:00 PM)
                </div>
              </div>
              <div className="info-row">
                <span className="info-icon">♻️</span>
                <div>
                  <strong>Processing:</strong> Secure & Environmentally Certified
                </div>
              </div>
            </div>

            {/* BUTTONS */}
            <div className="pass-actions">
              <button className="print-pass-btn" onClick={() => window.print()}>
                🖨️ Print / Save Pass
              </button>
              <button
                className="simulate-scan-btn"
                onClick={() => navigate(`/centre/dashboard?dispId=${createdDisposal.id}`)}
              >
                ♻️ Proceed to Collection Centre Scan Terminal →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================
     SCREEN 1: USER ITEM SELECTION & GPS DISPOSAL FORM
     ======================================================== */
  return (
    <div className="dispose-page-root">
      {/* VERIFICATION BANNER */}
      <div className="linked-bag-banner">
        <div className="bag-badge">
          <span className="pulse-dot"></span>
          <span>DISPOSAL ID LINK: <strong>{bagId}</strong></span>
        </div>
        <div className="bag-partner">
          Partner Brand: <strong>{brandName}</strong> &bull; Verified Disposal ♻️
        </div>
      </div>

      <div className="dispose-main-layout">
        {/* LEFT COLUMN: ITEM SELECTION & MANDATORY INSTRUCTIONS */}
        <div className="dispose-form-column">
          <div className="section-card">
            <div className="step-header">
              <span className="step-num">1</span>
              <div>
                <h2>Pick what you’re tossing</h2>
                <p>Choose the e-waste item you’re giving a second life to. Low-key easy.</p>
              </div>
            </div>

            <div className="items-grid">
              {items.map((it) => (
                <button
                  key={it.name}
                  type="button"
                  className={`item-select-btn ${selectedItem === it.name ? "selected" : ""}`}
                  onClick={() => handleSelectItem(it)}
                >
                  <span className="item-icon">{it.icon}</span>
                  <span className="item-name">{it.name}</span>
                  <span className="item-weight">~{it.weight} kg</span>
                </button>
              ))}
            </div>

            <div className="custom-item-row">
              <label>Specific Model / Notes (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Samsung Galaxy S20, Serial: SM-G980F"
                value={itemCondition}
                onChange={(e) => setItemCondition(e.target.value)}
              />
            </div>
          </div>

          {/* MANDATORY HANDLING INSTRUCTIONS (REQUESTED BY USER) */}
          <div className="section-card instructions-card">
            <div className="step-header">
              <span className="step-num">2</span>
              <div>
                <h2>Quick safety check before you drop it</h2>
                <p>Do these tiny but important steps before packing it up. No stress, just safe recycling.</p>
              </div>
            </div>

            <div className="instructions-list-box">
              <h3>⚠️ Precautions for {selectedItem}:</h3>
              <ul>
                {(mandatoryInstructions[selectedItem] || mandatoryInstructions["Mobile Phone"]).map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
            </div>

            <div className="checklist-box">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={checklistConfirmed.dataWiped}
                  onChange={(e) =>
                    setChecklistConfirmed({ ...checklistConfirmed, dataWiped: e.target.checked })
                  }
                />
                <span>I have wiped personal data / removed SIM or external memory cards.</span>
              </label>

              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={checklistConfirmed.batterySafe}
                  onChange={(e) =>
                    setChecklistConfirmed({ ...checklistConfirmed, batterySafe: e.target.checked })
                  }
                />
                <span>Battery is not punctured and insulated against short circuits.</span>
              </label>

              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={checklistConfirmed.packedInBag}
                  onChange={(e) =>
                    setChecklistConfirmed({ ...checklistConfirmed, packedInBag: e.target.checked })
                  }
                />
                <span>Item is safely packed and ready for drop-off.</span>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: GPS COLLECTION CENTRE SELECTOR & EMAIL SUBMIT */}
        <div className="dispose-sidebar-column">
          {/* GPS LOCATION & NEAREST CENTRE SELECTOR */}
          <div className="section-card gps-centre-card">
            <div className="step-header">
              <span className="step-num">3</span>
              <div>
                <h2>Find your nearest legit drop-off spot</h2>
                <p>Use GPS to locate the closest verified e-waste hub. Super quick, very vibes.</p>
              </div>
            </div>

            {/* GPS DETECTION BAR */}
            <div className="gps-detect-bar">
              <button
                type="button"
                className="detect-gps-btn"
                onClick={detectLiveGPS}
                disabled={locationStatus === "detecting"}
              >
                {locationStatus === "detecting" ? "📡 Pinpointing Satellite GPS..." : "📍 Use My Current GPS Location"}
              </button>
              <div className="gps-accuracy-pill">
                Accuracy: &plusmn;{location.accuracy || 15}m &bull; {location.source}
              </div>
            </div>

            {/* PRESET QUICK SELECT BUTTONS */}
            <div className="preset-cities-row">
              <span className="preset-label">Quick City Presets:</span>
              <div className="preset-chips">
                {presetLocations.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setLocation({ lat: p.lat, lng: p.lng, accuracy: 20, source: p.name });
                      fetchNearbyCenters({ lat: p.lat, lng: p.lng });
                    }}
                  >
                    {p.name.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* CENTRES LIST */}
            <div className="centers-scroll-list">
              {loadingCenters ? (
                <div className="loading-centres">Searching certified e-waste facilities...</div>
              ) : centers.length === 0 ? (
                <div className="no-centres">No centers found in this radius.</div>
              ) : (
                centers.map((c) => (
                  <div
                    key={c.id}
                    className={`centre-choice-card ${selectedCenter?.id === c.id ? "active-centre" : ""}`}
                    onClick={() => setSelectedCenter(c)}
                  >
                    <div className="centre-card-top">
                      <h4>{c.name}</h4>
                      {c.is_nearest && <span className="nearest-pill">⚡ NEAREST</span>}
                      {c.distance_km !== undefined && (
                        <span className="distance-pill">{c.distance_km} km away</span>
                      )}
                    </div>
                    <p className="centre-address">{c.address}</p>
                    <div className="centre-meta-tags">
                      {c.license_no && <span>License: {c.license_no}</span>}
                      <span>Hours: 9 AM – 6 PM</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* INTERACTIVE MAP PREVIEW */}
            {centers.length > 0 && (
              <div className="map-preview-embed">
                <NearbyCentersMap
                  userLocation={location}
                  centers={centers}
                  selectedCenter={selectedCenter}
                  onSelectCenter={(c) => setSelectedCenter(c)}
                />
              </div>
            )}
          </div>

          {/* USER EMAIL & SUBMISSION CARD */}
          <div className="section-card submit-email-card">
            <div className="step-header">
              <span className="step-num">4</span>
              <div>
                <h2>Drop your email to get the pass & reward</h2>
                <p>We’ll send your disposal ID, QR pass, and reward update to this email. No drama.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitDisposal}>
              <div className="form-group">
                <label>Your Email Address (Mandatory):</label>
                <input
                  type="email"
                  placeholder="e.g. yourname@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
                <span className="field-hint">Your QR pass and reward reveal link will land here, easy peasy.</span>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Your Name (Optional):</label>
                  <input
                    type="text"
                    placeholder="e.g. Arun Sharma"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number (Optional):</label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                  />
                </div>
              </div>

              {selectedCenter && (
                <div className="selected-summary-box">
                  <div>
                    <strong>Selected Centre:</strong> {selectedCenter.name}
                  </div>
                  <div>
                    <strong>Estimated Weight:</strong> {estimatedWeight} kg &bull; <strong>Item:</strong> {selectedItem}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="submit-disposal-btn"
                disabled={submitting || !selectedCenter || !userEmail.trim()}
              >
                {submitting ? "⏳ Making your pass..." : "✨ Generate my pass & QR →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DisposePage;
