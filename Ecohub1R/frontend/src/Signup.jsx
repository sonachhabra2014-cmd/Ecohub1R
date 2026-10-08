import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./enterprise.css";

function Signup({ onBackToLogin }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("New Delhi");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsError(false);

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match. Please re-enter.");
      return;
    }

    if (password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setMessage("Creating user account and issuing cryptographic verification token...");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          phone: phone.trim(),
          city: city.trim(),
          role: "user"
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("authToken", data.token);
          localStorage.setItem("ecohub_token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("ecohub_user", JSON.stringify(data.user));
        }
        setIsRegistered(true);
        setMessage("Account created successfully!");
      } else {
        setIsError(true);
        setMessage(data.error || data.message || "Unable to register account.");
      }
    } catch (error) {
      setIsError(true);
      setMessage("Unable to establish secure connection with registration server.");
    } finally {
      setLoading(false);
    }
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
          <Link to="/login" className="btn-secondary-action">Sign In</Link>
        </div>
      </nav>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{
          background: "#FFFFFF",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "3rem 2.5rem",
          maxWidth: "500px",
          width: "100%",
          boxShadow: "var(--shadow-md)"
        }}>
          {!isRegistered ? (
            <>
              <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                <span style={{ display: "inline-block", background: "var(--accent-light)", color: "var(--primary)", fontWeight: "600", fontSize: "0.8rem", padding: "4px 12px", borderRadius: "9999px", marginBottom: "0.75rem" }}>
                  CITIZEN REGISTRATION
                </span>
                <h1 style={{ fontSize: "1.85rem", fontWeight: "700", color: "var(--secondary)", margin: "0 0 0.5rem" }}>
                  Create Individual Account
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>
                  Enter your credentials to start disposing e-waste and collecting verified reward points.
                </p>
              </div>

              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Arun Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                    Email Address (For Verification Pass)
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        outline: "none"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="New Delhi"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Min. 6 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        outline: "none"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.35rem" }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        outline: "none"
                      }}
                    />
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
                    marginTop: "0.5rem"
                  }}
                >
                  {loading ? "Registering & Dispatching Verification..." : "Create Account & Verify Email"}
                </button>
              </form>

              <div style={{ borderTop: "1px solid var(--border)", marginTop: "1.75rem", paddingTop: "1.25rem", textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Already registered?{" "}
                <Link to="/login" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
                  Sign In to Account &rarr;
                </Link>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--accent-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem" }}>
                ✓
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: "700", marginBottom: "0.75rem", color: "var(--secondary)" }}>
                Account Created Successfully!
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                Welcome to EcoHub. Your citizen profile is now fully active.
              </p>
              <div style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                🛡️ Your citizen wallet is provisioned. You can now generate verified disposal passes for laptops, mobiles, and electronics and earn EcoCredits.
              </div>
              <button
                onClick={() => {
                  window.location.href = "/citizen";
                }}
                className="btn-primary-action"
                style={{ width: "100%", padding: "0.85rem", justifyContent: "center" }}
              >
                Proceed to Dashboard &rarr;
              </button>
            </div>
          )}
        </div>
      </main>

      <footer style={{ background: "#FFFFFF", borderTop: "1px solid var(--border)", padding: "1.25rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        &copy; {new Date().getFullYear()} EcoHub. Certified Evidence-Based E-Waste Protocol.
      </footer>
    </div>
  );
}

export default Signup;
