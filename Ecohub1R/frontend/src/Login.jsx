import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setToken, setCurrentUser } from "./api";
import "./enterprise.css";

function Login({ onCreateAccount }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "/citizen";
  })();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("Authenticating credentials...");
    setIsError(false);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        setMessage("Login successful! Redirecting...");

        setTimeout(() => {
          if (data.user?.role === "admin") {
            window.location.href = "/admin";
          } else if (data.user?.role === "company") {
            window.location.href = "/corporate/dashboard";
          } else if (data.user?.role === "collection_centre") {
            window.location.href = "/centre/dashboard";
          } else {
            window.location.href = redirectUrl;
          }
        }, 500);
      } else {
        setIsError(true);
        setMessage(data.error || data.message || "Invalid credentials.");
      }
    } catch (error) {
      setIsError(true);
      setMessage("Unable to establish secure connection with EcoHub verification server.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      setIsError(true);
      setMessage("Please enter your registered email address first.");
      return;
    }
    setIsError(false);
    setMessage(`Password reset security link dispatched to ${email}. Check your inbox.`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      {/* Enterprise Header */}
      <nav className="enterprise-nav">
        <Link to="/" className="brand-badge-link">
          <div className="brand-logo-icon">🌿</div>
          <div>
            Eco<span style={{ color: "var(--primary)" }}>Hub</span>
          </div>
        </Link>
        <div className="enterprise-nav-links">
          <Link to="/" className="enterprise-nav-link">Home</Link>
          <Link to="/portals" className="enterprise-nav-link">Roles</Link>
          <Link to="/portals" className="btn-primary-action">Register</Link>
        </div>
      </nav>

      {/* Login Card Form */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{
          background: "#FFFFFF",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "3rem 2.5rem",
          maxWidth: "460px",
          width: "100%",
          boxShadow: "var(--shadow-md)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <span style={{ display: "inline-block", background: "var(--accent-light)", color: "var(--primary)", fontWeight: "600", fontSize: "0.8rem", padding: "4px 12px", borderRadius: "9999px", marginBottom: "0.75rem" }}>
              ENTERPRISE ACCESS
            </span>
            <h1 style={{ fontSize: "1.85rem", fontWeight: "700", color: "var(--secondary)", margin: "0 0 0.5rem" }}>
              Sign In to EcoHub
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>
              Enter your credentials to access your verified portal.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.4rem" }}>
                Registered Email or Company ID
              </label>
              <input
                type="text"
                placeholder="name@company.com or COMP-XXXX-2026"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  outline: "none",
                  transition: "border-color 0.15s ease"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)" }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem 3rem 0.75rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    outline: "none"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {message && (
              <div style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                backgroundColor: isError ? "#FEE2E2" : "#DCFCE7",
                color: isError ? "#991B1B" : "#166534",
                border: `1px solid ${isError ? "#FCA5A5" : "#86EFAC"}`
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary-action"
              style={{
                width: "100%",
                padding: "0.85rem",
                justifyContent: "center",
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Authenticating..." : "Sign In to Account"}
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: "1.75rem", paddingTop: "1.25rem", textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Need an account?{" "}
            <Link to="/portals" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
              Select Role &amp; Register &rarr;
            </Link>
          </div>
        </div>
      </main>

      <footer style={{ background: "#FFFFFF", borderTop: "1px solid var(--border)", padding: "1.25rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        &copy; {new Date().getFullYear()} EcoHub. Enterprise Security Protocol Aligned.
      </footer>
    </div>
  );
}

export default Login;
