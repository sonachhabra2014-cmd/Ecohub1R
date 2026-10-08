import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken, setCurrentUser } from "./api";
import "./Style.css"; 

function CollectionPointLogin() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("Authenticating Collection Centre...");
    setLoading(true);

    const cleanId = collectionId.trim();
    const cleanPwd = password.trim();

    try {
      const response = await fetch("/api/collection-centres/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: cleanId,
          assigned_code: cleanId,
          email: cleanId,
          password: cleanPwd,
        }),
      });

      const data = await response.json();

      if (response.ok && (data.token || data.success)) {
        const userObj = data.user || data.centre || { name: 'Collection Point Officer', role: 'collection_centre' };
        
        if (userObj.role && userObj.role !== 'collection_centre' && userObj.role !== 'admin') {
          setMessage("Unauthorized: This portal is strictly for Authorized Collection Centres.");
          setLoading(false);
          return;
        }

        if (data.token) {
          setToken(data.token);
        }
        setCurrentUser(userObj);
        setMessage("Login successful! Accessing Scanner Terminal...");

        setTimeout(() => {
          navigate("/centre/dashboard");
        }, 600);
      } else {
        setMessage(data.error || "Invalid credentials.");
      }
    } catch (error) {
       // Demo fallback for offline test
       if (cleanId.toUpperCase() === "CP001" && cleanPwd === "Green@2026") {
          setToken("demo-centre-token-2026");
          const userObj = { name: 'Demo Officer', role: 'collection_centre', assigned_code: 'CP001' };
          setCurrentUser(userObj);
          setMessage("Login successful! Accessing Scanner Terminal...");
          setTimeout(() => {
            navigate("/centre/dashboard");
          }, 600);
       } else {
          setMessage("Unable to connect to the server.");
       }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="brand-section" style={{background: 'linear-gradient(135deg, #0C1A2E, #050E1A)'}}>
        <div className="brand-content">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <span className="logo-icon">♻️</span>
            <span>ECO<span style={{color: '#38BDF8'}}>HUB</span></span>
          </div>
          <div className="brand-message">
            <h1>Authorized<br/><span>Collection Terminal</span></h1>
            <p>Scan e-waste. Verify weight.<br/>Trigger verified citizen rewards.</p>
          </div>
        </div>
      </section>
      <section className="form-section">
        <div className="login-card glass-card">
          <div className="form-header">
            <h2>Centre Terminal Login</h2>
            <p>Enter your assigned Centre Code or registered email</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Collection Centre Code or Email</label>
              <input
                type="text"
                value={collectionId}
                placeholder="e.g. CP001 or email"
                onChange={e => setCollectionId(e.target.value)}
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
                  onChange={e => setPassword(e.target.value)}
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
              style={{background: 'linear-gradient(135deg, #38BDF8, #0284C7)', color: '#FFFFFF', fontWeight: 700}}
            >
              {loading ? "AUTHENTICATING..." : "ACCESS TERMINAL"}
            </button>
          </form>
          {message && (
            <p
              className="login-message"
              style={{
                color: message.includes("successful") ? "#38BDF8" : "#F87171",
                marginTop: '1rem',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              {message}
            </p>
          )}
          <div className="signup-text">
            <span>New Collection Partner?</span>
            <button type="button" onClick={() => navigate('/centre/register')}>
              Apply for Authorization
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CollectionPointLogin;
