import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Public / Entry
import LandingPage from "./pages/LandingPage";
import RoleSelectionPage from "./pages/RoleSelectionPage";
import { PrivacyPolicyPage, TermsPage } from "./pages/LegalPages";


// Layouts
import CitizenLayout from "./layouts/CitizenLayout";
import CentreLayout from "./layouts/CentreLayout";
import CorporateLayout from "./layouts/CorporateLayout";
// Removed AdminLayout since it is backend-only

// Citizen Pages
import CitizenDisposalFlow from "./pages/CitizenDisposalFlow";
import ClaimAward from "./pages/ClaimAward";
import EcoCreditsWallet from "./pages/EcoCreditsWallet";
import CitizenVideoChallenge from "./pages/CitizenVideoChallenge";

// Centre Pages
import CollectionPointLogin from "./CollectionPointLogin";
import CollectionPointRegister from "./CollectionPointRegister";
import CollectionCentrePortal from "./pages/CollectionCentrePortal";

// Corporate Pages
import CorporateLoginPage from "./pages/CorporateLoginPage";
import CompanyRegister from "./CompanyRegister";
import CompanyDashboard from "./pages/CompanyDashboard";

// Auth
import Signup from "./Signup";
import Verify from "./Verify";
import Login from "./Login";

function App() {
  return (
    <Router>
      <Routes>
        {/* PUBLIC ENTRY */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/portals" element={<Navigate to="/" replace />} />
        <Route path="/roles" element={<Navigate to="/portals" replace />} />

        {/* STANDALONE VERIFICATION */}
        <Route path="/verify/:token" element={<Verify />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ==================== CITIZEN PORTAL ==================== */}
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index element={<CitizenDisposalFlow />} />
          <Route path="dispose" element={<CitizenDisposalFlow />} />
          <Route path="claim" element={<ClaimAward />} />
          <Route path="challenge" element={<CitizenVideoChallenge />} />
          <Route path="wallet" element={<EcoCreditsWallet />} />
        </Route>

        {/* Legacy Citizen redirects */}
        <Route path="/dispose" element={<Navigate to="/citizen" replace />} />
        <Route path="/claim-award" element={<Navigate to="/citizen/claim" replace />} />
        <Route path="/wallet" element={<Navigate to="/citizen/wallet" replace />} />

        {/* ==================== CENTRE PORTAL ==================== */}
        <Route path="/centre/login" element={<CollectionPointLogin />} />
        <Route path="/centre/register" element={<CollectionPointRegister />} />

        <Route path="/centre" element={<CentreLayout />}>
          <Route path="dashboard" element={<CollectionCentrePortal />} />
        </Route>

        {/* Legacy Centre redirects */}
        <Route path="/collection-login" element={<Navigate to="/centre/login" replace />} />
        <Route path="/collection-register" element={<Navigate to="/centre/register" replace />} />
        <Route path="/collection-centre" element={<Navigate to="/centre/dashboard" replace />} />

        {/* ==================== CORPORATE PORTAL ==================== */}
        <Route path="/corporate/login" element={<CorporateLoginPage />} />
        <Route path="/corporate/register" element={<CompanyRegister />} />

        <Route path="/corporate" element={<CorporateLayout />}>
          <Route path="dashboard" element={<CompanyDashboard />} />
        </Route>

        {/* Legacy Corporate redirects */}
        <Route path="/company-login" element={<Navigate to="/corporate/login" replace />} />
        <Route path="/company-register" element={<Navigate to="/corporate/register" replace />} />
        <Route path="/company-dashboard" element={<Navigate to="/corporate/dashboard" replace />} />

        {/* ==================== LEGAL & INFORMATION PAGES ==================== */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* 404 FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;
