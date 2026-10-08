import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, setToken, setCurrentUser } from '../api';

function CorporateLayout() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    navigate('/');
  };

  return (
    <div className="ecohub-app-root">
      <header className="portal-navbar corporate-navbar">
        <div className="nav-inner">
          <Link to="/" className="nav-portal-logo">
            <div className="nav-portal-logo-icon">🏢</div>
            <div className="nav-portal-brand">ECO<span className="ph">HUB</span></div>
            <div className="nav-portal-role-tag">Corporate</div>
          </Link>
          <nav className="nav-portal-links">
            <Link to="/corporate/dashboard" className="nav-portal-link">ESG Dashboard</Link>
          </nav>
          <div className="nav-portal-right">
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

export default CorporateLayout;
