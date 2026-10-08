import React, { useEffect, useRef } from "react";

function NearbyCentersMap({ userLocation, centers, selectedCenter, onSelectCenter }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet (window.L) is available
    if (typeof window !== "undefined" && window.L && userLocation) {
      // Destroy existing map instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const L = window.L;

      // Initialize map
      const map = L.map(mapContainerRef.current).setView(
        [userLocation.lat, userLocation.lng],
        13
      );
      mapInstanceRef.current = map;

      // Add OpenStreetMap tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom User Location Pin (Blue with pulse)
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `<div style="
          background: #3b82f6;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 12px #3b82f6;
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
      }).addTo(map);

      userMarker.bindPopup(
        `<strong>📍 Your Exact GPS Location</strong><br/>` +
        `Lat: ${userLocation.lat.toFixed(5)}, Lng: ${userLocation.lng.toFixed(5)}` +
        (userLocation.accuracy ? `<br/><small>Accuracy: ±${Math.round(userLocation.accuracy)}m</small>` : "")
      );

      // Add accuracy circle if accuracy is known
      if (userLocation.accuracy && userLocation.accuracy < 5000) {
        L.circle([userLocation.lat, userLocation.lng], {
          radius: userLocation.accuracy,
          color: "#3b82f6",
          fillColor: "#60a5fa",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);
      }

      // Bounds array to fit all points
      const bounds = [[userLocation.lat, userLocation.lng]];

      // Collection center markers
      markersRef.current = [];
      centers.forEach((center) => {
        if (!center.latitude || !center.longitude) return;

        bounds.push([center.latitude, center.longitude]);

        const isNearest = center.is_nearest;
        const isSelected = selectedCenter && selectedCenter.name === center.name;

        const pinColor = isSelected ? "#eab308" : isNearest ? "#22c55e" : "#10b981";

        const centerIcon = L.divIcon({
          className: "custom-center-marker",
          html: `<div style="
            background: ${pinColor};
            color: white;
            padding: 4px 7px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 3px;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">
            ♻️ ${center.distance_km !== undefined ? center.distance_km + ' km' : ''}
          </div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 24],
        });

        const marker = L.marker([center.latitude, center.longitude], {
          icon: centerIcon,
        }).addTo(map);

        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${center.latitude},${center.longitude}`;

        const popupContent = `
          <div style="font-family: sans-serif; color: #1e293b; min-width: 180px;">
            <h4 style="margin: 0 0 5px 0; color: #15803d; font-size: 14px;">${center.name}</h4>
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #475569;">${center.address}</p>
            ${
              center.distance_km !== undefined
                ? `<p style="margin: 0 0 8px 0; font-weight: bold; font-size: 13px; color: #047857;">📍 ${center.distance_km} km away ${isNearest ? '(Nearest)' : ''}</p>`
                : ""
            }
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block;
              background: #22c55e;
              color: white;
              padding: 5px 10px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 12px;
              font-weight: bold;
            ">🧭 Get Directions</a>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on("click", () => {
          if (onSelectCenter) onSelectCenter(center);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds if more than 1 point
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, [userLocation, centers, selectedCenter]);

  if (!userLocation) return null;

  return (
    <div className="gps-map-wrapper">
      <div className="map-header">
        <span className="map-title">🗺️ Live GPS Radar & Proximity Map</span>
        <span className="map-hint">
          {centers.length} center{centers.length === 1 ? "" : "s"} plotted relative to your location
        </span>
      </div>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "360px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "2px solid #22c55e",
        }}
      />
    </div>
  );
}

export default NearbyCentersMap;
