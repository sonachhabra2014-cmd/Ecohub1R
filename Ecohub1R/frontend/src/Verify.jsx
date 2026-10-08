import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function Verify() {
  const { token } = useParams();
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/company-registration/verify/${token}/`
        );
        if (response.ok) {
          setMessage("✅ Your email has been verified successfully!");
        } else {
          setMessage("❌ Invalid or expired verification link.");
        }
      } catch (error) {
        setMessage("⚠ Unable to connect to the server.");
      }
    };
    verifyEmail();
  }, [token]);

  return (
    <div className="verify-page">
      <h2>{message}</h2>
    </div>
  );
}

export default Verify;   // ✅ critical lineexport default App;

