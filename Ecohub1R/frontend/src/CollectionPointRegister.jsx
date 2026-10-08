import React, { useState, useEffect, useRef } from "react";
import "./CollectionPointRegister.css";

export default function CollectionPointRegister() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapPosition, setMapPosition] = useState({ lat: 28.6139, lng: 77.209 });
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);

  const [formData, setFormData] = useState({
    centerName: "",
    officerName: "",
    email: "",
    phone: "",
    address: "",
    licenseNumber: "",
    password: "",
  });

  // Load Leaflet from CDN dynamically
  useEffect(() => {
    // Inject Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Inject Leaflet JS
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else if (window.L) {
      setMapReady(true);
    }

    // Try auto-locate
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMapPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  // Initialize map once Leaflet is loaded
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMapRef.current) return;

    const L = window.L;
    const map = L.map(mapRef.current).setView([mapPosition.lat, mapPosition.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([mapPosition.lat, mapPosition.lng], { draggable: true }).addTo(map);
    marker.bindPopup("📍 Collection Centre Location").openPopup();

    // Update position on marker drag
    marker.on("dragend", (e) => {
      const latlng = e.target.getLatLng();
      setMapPosition({ lat: latlng.lat, lng: latlng.lng });
    });

    // Update position on map click
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      setMapPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    leafletMapRef.current = map;
    markerRef.current = marker;
  }, [mapReady]);

  // Recenter map if auto-location updates
  useEffect(() => {
    if (leafletMapRef.current && markerRef.current) {
      leafletMapRef.current.setView([mapPosition.lat, mapPosition.lng], 13);
      markerRef.current.setLatLng([mapPosition.lat, mapPosition.lng]);
    }
  }, [mapPosition.lat, mapPosition.lng]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/collection-centres/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.centerName,
          officer_name: formData.officerName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          license_number: formData.licenseNumber,
          latitude: mapPosition.lat,
          longitude: mapPosition.lng,
          password: formData.password,
        }),
      });

      let data = {};
      try { data = await response.json(); } catch { data = {}; }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server returned ${response.status}`);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Registration Error:", err);
      setError(err.message || "Could not submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="success-container">
        <div className="success-card">
          <h1>✅ Registration Successful</h1>
          <p className="email-note">Your application has been submitted successfully.</p>
          <p className="email-note">After EcoHub Admin verification, Collection Centre credentials will be sent to your registered email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>♻️ EcoHub</h1>
        <h2>Collection Point Registration</h2>

        {error && (
          <div style={{
            background: "rgba(239,68,68,.15)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "12px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "14px",
            lineHeight: "1.5",
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input type="text" name="centerName" placeholder="Collection Centre Name" value={formData.centerName} onChange={handleChange} required />
          <input type="text" name="officerName" placeholder="Officer / Contact Person" value={formData.officerName} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required />
          <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
          <textarea name="address" placeholder="Collection Centre Address" value={formData.address} onChange={handleChange} required />
          <input type="text" name="licenseNumber" placeholder="License Number" value={formData.licenseNumber} onChange={handleChange} required />

          {/* Interactive Map */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "#cbd5e1", fontWeight: "600" }}>
              📍 Pinpoint Centre Location on Map
            </label>
            <div
              ref={mapRef}
              style={{
                height: "260px",
                width: "100%",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid #334155",
                background: "#1e293b",
              }}
            />
            {!mapReady && (
              <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>⏳ Loading map...</p>
            )}
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
              🖱️ Click on the map or drag the pin to set the exact location.
              &nbsp;📌 Current: <strong style={{ color: "#38bdf8" }}>{mapPosition.lat.toFixed(5)}, {mapPosition.lng.toFixed(5)}</strong>
            </p>
          </div>

          <input type="password" name="password" placeholder="Login Password" value={formData.password} onChange={handleChange} required />

          <button type="submit" disabled={loading}>
            {loading ? "Submitting Registration..." : "Register Collection Point"}
          </button>
        </form>
      </div>
    </div>
  );
}
