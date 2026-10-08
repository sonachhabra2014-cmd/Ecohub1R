import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken, setCurrentUser } from "../api";
import "../Style.css";

function CorporateLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("Authenticating Corporate Partner...");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        if (data.user?.role !== 'company') {
          setMessage("Unauthorized: This portal is strictly for Corporate Partners.");
          setLoading(false);
          return;
        }

        setToken(data.token);
        setCurrentUser(data.user);
        setMessage("Login successful! Accessing Corporate Dashboard...");

        setTimeout(() => {
          navigate("/corporate/dashboard");
        }, 600);
      } else {
        setMessage(data.error || "Invalid credentials.");
      }
    } catch (error) {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="brand-section" style={{ background: 'linear-gradient(135deg, #101D40, #0A1A35)' }}>
        <div className="brand-content">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <span className="logo-icon">🏢</span>
            <span>ECO<span style={{ color: '#00E676' }}>HUB</span></span>
          </div>
          <div className="brand-message">
            <h1>Corporate<br /><span>ESG Portal</span></h1>
            <p>Manage your Extended Producer Responsibility.<br />Track real-time verified impact.</p>
          </div>
        </div>
      </section>
      <section className="form-section">
        <div className="login-card glass-card">
          <div className="form-header">
            <h2>Corporate Partner Login</h2>
            <p>Use your assigned Company ID or registered official email.</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Company ID or Email</label>
              <input
                type="text"
                value={email}
                placeholder="e.g. COMP-SONAL-2026-127 or email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder="Enter password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="show-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{ background: 'linear-gradient(135deg, #00E676, #00C853)', color: '#050B14', fontWeight: 700 }}
            >
              {loading ? "AUTHENTICATING..." : "SECURE LOGIN"}
            </button>
          </form>
          {message && (
            <p
              className="login-message"
              style={{
                color: message.includes("successful") ? "#00E676" : "#F87171",
                marginTop: '1rem',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              {message}
            </p>
          )}
          <div className="signup-text">
            <span>New Corporate Partner?</span>
            <button type="button" onClick={() => navigate('/corporate/register')}>
              Apply for EPR Partnership
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CorporateLoginPage;
