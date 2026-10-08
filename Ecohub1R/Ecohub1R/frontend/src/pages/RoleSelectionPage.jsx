import React from "react";
import { Link } from "react-router-dom";
import "../enterprise.css";

function RoleSelectionPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <nav className="enterprise-nav">
        <Link to="/" className="brand-badge-link">
          <div className="brand-logo-icon">🌿</div>
          <div>
            Eco<span style={{ color: "var(--primary)" }}>Hub</span>
          </div>
        </Link>
        <div className="enterprise-nav-links">
          <Link to="/" className="enterprise-nav-link">Home</Link>
        </div>
      </nav>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: "1000px", margin: "0 auto", padding: "4rem 2rem", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "inline-block", background: "var(--accent-light)", color: "var(--primary)", fontWeight: "600", fontSize: "0.85rem", padding: "4px 14px", borderRadius: "9999px", marginBottom: "1rem" }}>
            PORTAL ACCESS GATEWAY
          </span>
          <h1 style={{ fontSize: "2.4rem", fontWeight: "700", color: "var(--secondary)", marginBottom: "0.75rem" }}>
            Select Your Account Role
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto" }}>
            Start a citizen disposal without creating an account, or sign in or register an organization.
          </p>
        </div>

        {/* ONLY TWO ROLES: User & Company */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "2rem" }}>
          {/* ROLE 1: INDIVIDUAL USER */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease"
          }}>
            <div>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: "var(--accent-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
                marginBottom: "1.5rem"
              }}>
                👤
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.5rem" }}>
                Citizen Disposal
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                No account is needed. Scan a company EcoBag QR code, follow the disposal instructions, and enter your email to receive your disposal ID.
              </p>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem", marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Disposal Journey:
                </div>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.8" }}>
                  <li>Company-linked EcoBag QR scan</li>
                  <li>Item-specific disposal instructions</li>
                  <li>Email delivery of your disposal ID</li>
                  <li>Collection-centre verification and record updates</li>
                </ul>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link to="/citizen" className="btn-primary-action" style={{ textAlign: "center", justifyContent: "center" }}>
                Start Disposal Journey &rarr;
              </Link>
            </div>
          </div>

          {/* ROLE 2: COMPANY / PRODUCER */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease"
          }}>
            <div>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
                marginBottom: "1.5rem"
              }}>
                🏢
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.5rem" }}>
                Company / Organization
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                For electronics manufacturers, IT asset disposal managers, and enterprises fulfilling Extended Producer Responsibility (EPR) mandates and ESG reporting.
              </p>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem", marginBottom: "2rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--secondary)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Key Enterprise Modules:
                </div>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.8" }}>
                  <li>Compliance review &amp; automated approval email</li>
                  <li>Tenant-isolated ESG metrics &amp; Impact Reports</li>
                  <li>Order serialized tracking bags for consumers</li>
                  <li>Audited chain-of-custody material tracking</li>
                </ul>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link to="/corporate/register" className="btn-primary-action" style={{ textAlign: "center", justifyContent: "center", backgroundColor: "var(--secondary)" }}>
                Register Enterprise Company &rarr;
              </Link>
              <Link to="/corporate/login" className="btn-secondary-action" style={{ textAlign: "center", justifyContent: "center" }}>
                Corporate Portal Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: "#FFFFFF", borderTop: "1px solid var(--border)", padding: "1.5rem 2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        &copy; {new Date().getFullYear()} EcoHub Platform. Certified for National E-Waste Verification.
      </footer>
    </div>
  );
}

export default RoleSelectionPage;
