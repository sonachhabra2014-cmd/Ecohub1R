import React, { useState } from "react";
import "./CollectionPointRegister.css";

export default function CollectionPointRegister() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    centerName: "",
    officerName: "",
    email: "",
    phone: "",
    address: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/collection-centres/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.centerName,
            officer_name: formData.officerName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Server returned ${response.status}`
        );
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Registration Error:", err);

      setError(
        err.message ||
          "Could not submit registration. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="success-container">
        <div className="success-card">
          <h1>✅ Registration Successful</h1>

          <p className="email-note">
            Your application has been submitted successfully.
          </p>

          <p className="email-note">
            After EcoHub Admin verification, Collection Centre
            credentials will be sent to your registered email.
          </p>
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
          <div
            style={{
              background: "rgba(239,68,68,.15)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "12px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="centerName"
            placeholder="Collection Centre Name"
            value={formData.centerName}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="officerName"
            placeholder="Officer / Contact Person"
            value={formData.officerName}
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
          />

          <textarea
            name="address"
            placeholder="Collection Centre Address"
            value={formData.address}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Submitting Registration..."
              : "Register Collection Point"}
          </button>
          <p style={{ textAlign: "center", marginTop: "1rem" }}>
            Already have an account? <a href="/centre/login">Log in here</a>
          </p>
        </form>
      </div>
    </div>
  );
}
