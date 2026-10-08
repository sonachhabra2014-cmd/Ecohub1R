import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser, setToken, setCurrentUser } from '../api';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setUser] = useState(getCurrentUser());

  useEffect(() => {
    setUser(getCurrentUser());
  }, [location.pathname]);

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setUser(null);
    navigate('/');
  };

  const navPortals = [
    { name: 'Public User', path: '/citizen', icon: '👤', tag: 'Disposal Flow' },
    { name: 'Collection Centre', path: '/centre/dashboard', icon: '♻️', tag: 'Intake Terminal' },
    { name: 'Company', path: '/corporate/dashboard', icon: '🏢', tag: 'Compliance Portal' },
    { name: 'EcoHub Admin', path: '/admin/dashboard', icon: '🛡️', tag: 'Governance' }
  ];

  const isCurrent = (p) => location.pathname.startsWith(p);

  return (
    <header className="global-enterprise-header" style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      {/* TOP COMPLIANCE & TAGLINE BANNER */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #edf2f7',
        padding: '0.35rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.78rem',
        color: '#475569'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#0F9D58'
          }} />
          <strong style={{ color: '#0F9D58', letterSpacing: '0.04em' }}>ECOHUB GOVERNANCE</strong>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ fontWeight: '600', color: '#0369a1' }}>
            One Platform • One Record • Complete Waste Journey Visibility
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/about" style={{ color: '#64748b', textDecoration: 'none' }}>About System</Link>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <Link to="/contact" style={{ color: '#64748b', textDecoration: 'none' }}>Helpdesk</Link>
          {currentUser && (
            <>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {currentUser.name} ({currentUser.role?.toUpperCase() || 'USER'})
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#b91c1c',
                  cursor: 'pointer',
                  fontWeight: '600',
                  padding: 0,
                  fontSize: '0.78rem'
                }}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN NAVIGATION BAR */}
      <div style={{
        maxWidth: '1360px',
        margin: '0 auto',
        padding: '0.65rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* LOGO & PLATFORM TITLE */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#e6f4ea',
            color: '#0F9D58',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            fontWeight: '800'
          }}>
            🌿
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Eco<span style={{ color: '#0F9D58' }}>Hub</span>
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              E-Waste Compliance Registry
            </div>
          </div>
        </Link>

        {/* 4 ROLE-BASED PORTAL TABS */}
        <nav style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {navPortals.map((portal, idx) => {
            const active = isCurrent(portal.path);
            return (
              <Link
                key={portal.name}
                to={portal.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  fontSize: '0.86rem',
                  fontWeight: active ? '700' : '600',
                  color: active ? '#0F9D58' : '#334155',
                  backgroundColor: active ? '#e6f4ea' : 'transparent',
                  border: active ? '1px solid #bbf7d0' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{portal.icon}</span>
                <span>{portal.name}</span>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  backgroundColor: active ? '#ffffff' : '#f1f5f9',
                  color: active ? '#0F9D58' : '#64748b',
                  fontWeight: '600'
                }}>
                  {idx + 1}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* RIGHT ACTION: GET STARTED / DIRECT ENTRY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/portals"
            style={{
              backgroundColor: '#0F9D58',
              color: '#ffffff',
              padding: '0.55rem 1.15rem',
              borderRadius: '7px',
              fontWeight: '700',
              fontSize: '0.85rem',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(15, 157, 88, 0.2)'
            }}
          >
            Portal Selection →
          </Link>
        </div>
      </div>
    </header>
  );
}
