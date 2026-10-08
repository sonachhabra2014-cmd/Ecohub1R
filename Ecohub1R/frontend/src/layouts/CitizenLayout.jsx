import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, setToken, setCurrentUser } from '../api';

function CitizenLayout() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    navigate('/');
  };

  return (
    <div className="ecohub-app-root">
      <header className="portal-navbar citizen-navbar">
        <div className="nav-inner">
          <Link to="/" className="nav-portal-logo">
            <div className="nav-portal-logo-icon">🌿</div>
            <div className="nav-portal-brand">ECO<span className="ph">HUB</span></div>
            <div className="nav-portal-role-tag">Citizen</div>
          </Link>
          <nav className="nav-portal-links">
            <Link to="/citizen" className="nav-portal-link">Disposal Requests</Link>
            <Link to="/citizen/claim" className="nav-portal-link">Rewards</Link>
            <Link to="/citizen" className="nav-portal-link">Disposal History</Link>
            <Link to="/citizen" className="nav-portal-link">Collection Centres</Link>
            <Link to="/citizen/claim" className="nav-portal-link">Digital Certificates</Link>
          </nav>
          <div className="nav-portal-right">
            <Link to="/citizen/wallet" className="nav-wallet-pill">
              🪙 <span>Credits</span>
            </Link>
            {user && (
              <button onClick={handleLogout} className="nav-exit-btn">
                Log Out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="ecohub-main-container">
        <Outlet />
      </main>
    </div>
  );
}

export default CitizenLayout;
