import React from "react";
import { Link } from "react-router-dom";
import "../enterprise.css";

export default function StaticLegalPage({ title, lastUpdated, children }) {
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
          <Link to="/portals" className="enterprise-nav-link">Portals</Link>
          <Link to="/login" className="btn-secondary-action">Sign In</Link>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: "860px", margin: "0 auto", padding: "3.5rem 1.5rem", width: "100%" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: "16px", padding: "3rem", boxShadow: "var(--shadow-sm)" }}>
          <span style={{ display: "inline-block", background: "var(--accent-light)", color: "var(--primary)", fontWeight: "600", fontSize: "0.8rem", padding: "4px 12px", borderRadius: "9999px", marginBottom: "1rem" }}>
            OFFICIAL DOCUMENTATION
          </span>
          <h1 style={{ fontSize: "2.2rem", fontWeight: "700", color: "var(--secondary)", marginBottom: "0.5rem" }}>
            {title}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
            Effective Date &amp; Last Updated: {lastUpdated || "September 2026"} &bull; Regulatory Compliance Directive
          </p>

          <div style={{ color: "var(--secondary)", fontSize: "1rem", lineHeight: "1.75" }}>
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="enterprise-footer" style={{ padding: "2rem" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          <div>&copy; {new Date().getFullYear()} EcoHub. All rights reserved.</div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <Link to="/privacy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Privacy</Link>
            <Link to="/terms" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Terms</Link>
            <Link to="/contact" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
