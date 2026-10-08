import React from 'react';
import { Link } from 'react-router-dom';
import '../enterprise.css';

function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#050B14' }}>
      {/* MINIMAL NAV - EcoHub Logo & Text Branding Only */}
      <nav className="enterprise-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.5rem', height: '72px' }}>
        <Link to="/" className="brand-badge-link" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-logo-icon" style={{
            width: '38px', height: '38px', borderRadius: '8px',
            background: 'rgba(100,255,218,0.1)', color: '#64FFDA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', border: '1px solid rgba(100,255,218,0.2)'
          }}>
            🌿
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#E6F1FF', letterSpacing: '-0.01em' }}>
            Eco<span style={{ color: '#64FFDA' }}>Hub</span>
          </div>
        </Link>
      </nav>

      {/* HERO SECTION */}
      <header style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 1.5rem 4rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Ambient Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-5%', left: '50%', transform: 'translateX(-50%)',
          width: 'min(500px, 100%)', height: '500px',
          background: 'radial-gradient(circle, rgba(100,255,218,0.12) 0%, rgba(5,11,20,0) 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* HERO CONTENT */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          {/* Hero Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(100,255,218,0.1)', color: '#64FFDA',
            fontSize: '0.8rem', fontWeight: '600', padding: '6px 16px',
            borderRadius: '9999px', marginBottom: '1.5rem',
            border: '1px solid rgba(100,255,218,0.2)'
          }}>
            <span>●</span> E-Waste Verification &amp; Disposal Platform
          </div>

          {/* Hero Heading */}
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3.2rem)',
            fontWeight: 800,
            color: '#E6F1FF',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginBottom: '1.25rem'
          }}>
            Responsible E-Waste Disposal<br />With Verified Records
          </h1>

          {/* Hero Description */}
          <p style={{
            color: '#8892B0', fontSize: '1.1rem', lineHeight: 1.7,
            maxWidth: '620px', margin: '0 auto 2.25rem'
          }}>
            Register your organization to join the EcoHub network. Companies order QR-linked EcoBags, 
            citizens scan and dispose, collection centres verify — all tracked with real data.
          </p>

          {/* Start Disposal Journey Button */}
          <div className="landing-hero-cta">
            <Link to="/citizen" className="btn-primary-action" style={{
              justifyContent: 'center',
              padding: '0.9rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: '10px'
            }}>
              Start Disposal Journey &rarr;
            </Link>
          </div>
        </div>

        {/* TWO REGISTRATION CARDS */}
        <div className="registration-cards-container">
          {/* COMPANY CARD */}
          <div className="ecohub-reg-card company-card">
            <div className="card-content">
              <div className="card-icon-wrapper" style={{
                background: 'rgba(0,230,118,0.1)',
                border: '1px solid rgba(0,230,118,0.3)',
                color: '#00E676'
              }}>
                🏢
              </div>
              <h3 className="card-title">
                Company / Producer
              </h3>
              <p className="card-description">
                Register your electronics brand to order QR-linked EcoBags, 
                track verified disposals, and download real impact reports.
              </p>
            </div>

            <div className="card-actions">
              <Link to="/corporate/register" className="primary-card-btn">
                Register Company
              </Link>
              <Link to="/corporate/login" className="secondary-card-link">
                Login &rarr;
              </Link>
            </div>
          </div>

          {/* COLLECTION CENTRE CARD */}
          <div className="ecohub-reg-card centre-card">
            <div className="card-content">
              <div className="card-icon-wrapper" style={{
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.3)',
                color: '#38BDF8'
              }}>
                ♻️
              </div>
              <h3 className="card-title">
                Collection Centre
              </h3>
              <p className="card-description">
                Register your facility to receive e-waste, scan QR codes, 
                verify items with live camera, and log verified disposals.
              </p>
            </div>

            <div className="card-actions">
              <Link to="/centre/register" className="primary-card-btn">
                Register Centre
              </Link>
              <Link to="/centre/login" className="secondary-card-link">
                Login &rarr;
              </Link>
            </div>
          </div>
        </div>

      </header>

      {/* MINIMAL FOOTER */}
      <footer style={{
        background: '#0A192F',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: '#4A5568',
        fontSize: '0.8rem'
      }}>
        &copy; {new Date().getFullYear()} EcoHub &mdash; E-Waste Verification &amp; Disposal Platform
      </footer>
    </div>
  );
}

export default LandingPage;
