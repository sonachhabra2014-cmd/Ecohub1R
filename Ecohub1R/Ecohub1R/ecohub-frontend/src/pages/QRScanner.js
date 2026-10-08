import React from "react";
import QrReader from "react-qr-scanner";
import axios from "axios";

function QRScanner() {
  const handleScan = async (data) => {
    if (data) {
      const packageId = data.split("-")[1]; // extract packageId from QR data
      try {
        const res = await axios.get(`http://127.0.0.1:8000/order/${packageId}/activate/`);
        alert(res.data.message);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleError = (err) => {
    console.error(err);
  };

  return (
    <div>
      <h2>Scan QR to Activate Order</h2>
      <QrReader delay={300} onError={handleError} onScan={handleScan} style={{ width: "100%" }} />
    </div>
  );
}

export default QRScanner;
