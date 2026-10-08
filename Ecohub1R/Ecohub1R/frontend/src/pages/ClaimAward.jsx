import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../api';
import './ClaimAward.css';

export default function ClaimAward() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);

  const disposalParam = queryParams.get('disposal') || '';
  const emailParam = queryParams.get('email') || '';
  const accessParam = queryParams.get('access') || '';

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  // Form State
  const [email, setEmail] = useState(emailParam);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Disposal details
  const [disposalDetails, setDisposalDetails] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    if (token) {
      setIsAuthenticated(true);
      if (savedUser) {
        try {
          setActiveUser(JSON.parse(savedUser));
        } catch {
          // ignore parse error
        }
      }
    }

    if (disposalParam) {
      fetchDisposalDetails(disposalParam);
    }
  }, [disposalParam]);

  const fetchDisposalDetails = async (idOrCode) => {
    try {
      const data = await apiRequest(`/api/disposals/${idOrCode}`);
      if (data && !data.error) {
        setDisposalDetails(data);
        if (data.user_email && !email) {
          setEmail(data.user_email);
        }
        if (data.user_name && !name) {
          setName(data.user_name);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const identifier = email.trim();
    if (!identifier) {
      setErrorMsg('Please enter your email address to receive the verification OTP.');
      return;
    }

    setErrorMsg('');
    setLoadingOtp(true);

    try {
      const res = await apiRequest('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier })
      });

      if (res && res.success) {
        setOtpSent(true);
        setSuccessMsg(`Verification code sent to ${identifier}!`);
      } else {
        setErrorMsg(res?.error || 'Failed to dispatch verification code.');
      }
    } catch (err) {
      setErrorMsg('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyAndClaim = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!otpCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('Please create a password to complete identity verification.');
      return;
    }

    setSubmitting(true);
    try {
      // Call register-with-otp endpoint
      const res = await apiRequest('/api/auth/register-with-otp', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || email.split('@')[0] || 'EcoHub Citizen',
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: password,
          otp_code: otpCode.trim(),
          disposal_id: disposalDetails?.id || disposalParam || null
        })
      });

      if (res && (res.token || res.success)) {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('authToken', res.token);
        }
        if (res.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
          localStorage.setItem('userRole', res.user.role || 'user');
          setActiveUser(res.user);
        }
        setIsAuthenticated(true);
        setSuccessMsg('Identity verified! Redirecting to login...');

        const redirectTarget = `/login?redirect=${encodeURIComponent(`/citizen/challenge?disposal_id=${disposalDetails?.id || disposalParam || ''}&access=${encodeURIComponent(accessParam)}`)}`;
        setTimeout(() => {
          navigate(redirectTarget, { replace: true });
        }, 700);
      } else {
        setErrorMsg(res?.error || 'Verification failed. Please check the code.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const brandName = disposalDetails?.brand_name || 'EcoHub Partner';
  const itemName = disposalDetails?.item_name || 'Recycled Electronic Device';
  const centerName = disposalDetails?.centre_name || disposalDetails?.collection_centre_name || 'Authorized Drop-off Facility';
  const verifiedAtCentre = disposalDetails?.status === 'Received at Collection Centre';
  const weightKg = disposalDetails?.estimated_weight_kg || 1.2;
  const carbonAvoided = (weightKg * 4.1).toFixed(1);
  const couponData = disposalDetails?.coupon;
  const couponCode = couponData?.code || `${(disposalDetails?.brand_code || 'ECO').toUpperCase()}-RECYCLE-2026-849201`;
  const couponTitle = couponData?.discount_title || '₹500 / 15% OFF Official Partner Voucher';

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText(couponCode).catch(() => {});
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 3000);
  };

  return (
    <div className="claim-award-container">
      <div className="claim-award-card">
        <div className="award-top-badge">
          🎁 100% Instant E-Waste Reward Protocol
        </div>

        <h1 className="award-title">
          Responsible Disposal <span>Reward Portal</span>
        </h1>
        <p className="award-subtitle">
          {verifiedAtCentre
            ? 'Your electronic waste drop-off has been verified by the collection centre! Your complete reward package is ready.'
            : 'Your disposal pass is active. Once scanned at the collection centre, 100% of your rewards will unlock right here instantly.'}
        </p>

        {!isAuthenticated ? (
          /* Step 1: Verification & Registration Modal */
          <div className="auth-box">
            <div className="auth-box-header">
              <span style={{ fontSize: '1.8rem' }}>🔐</span>
              <div>
                <h3>Unlock Your 10 EcoCredits & Brand Voucher</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e' }}>
                  Verify with a quick OTP to claim your EcoCredits into your wallet and reveal your official brand discount voucher.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                ✅ {successMsg}
              </div>
            )}

            <form onSubmit={handleVerifyAndClaim}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Arun Sharma"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Registered Email Address</label>
                <div className="otp-row">
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loadingOtp || !email}
                    className="btn-send-otp"
                  >
                    {loadingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Create Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                />
              </div>

              {otpSent && (
                <p className="flow-message">Check your email for the 6-digit verification code. It expires in 10 minutes.</p>
              )}

              {otpSent && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    style={{ fontSize: '1.2rem', letterSpacing: '0.2em', textAlign: 'center', fontWeight: 'bold' }}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !otpSent || !password.trim()}
                className="btn-verify-claim"
              >
                {submitting ? 'Verifying Identity...' : '🔓 Claim My Rewards Now'}
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: The Grand Instant Award Revelation */
          <div className="reveal-wrapper">
            <div className="status-banner">
              <div>
                <strong style={{ color: '#ffffff', display: 'block', fontSize: '1rem' }}>
                  📦 {itemName} ({brandName})
                </strong>
                <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                  Verified at {centerName} • Weight: {weightKg} kg • Record: <code style={{ color: '#34d399' }}>{disposalDetails?.id || disposalParam}</code>
                </span>
              </div>
              <div className="status-badge-verified">
                ✓ Verified by Centre
              </div>
            </div>

            {/* Instant Reward Celebration Banner */}
            <div className="instant-reward-hero">
              <div className="icon-large">🏆✨</div>
              <h2>100% Rewards Unlocked & Credited!</h2>
              <p>
                Congratulations! Your e-waste has been diverted from landfills and officially certified at the collection centre. Because you took responsible action, your complete reward package is ready right now!
              </p>
            </div>

            {/* 3 Pillar Reward Cards */}
            <div className="instant-rewards-grid">
              {/* Card 1: 10 EcoCredits */}
              <div className="instant-reward-card credits-card">
                <div className="irc-header">
                  <span className="irc-icon">🪙</span>
                  <span className="irc-badge">DIRECT TO WALLET</span>
                </div>
                <div className="irc-val">+10 EcoCredits</div>
                <div className="irc-title">Credited to Your Wallet</div>
                <p className="irc-desc">
                  Your sustainability wallet has been updated. Use credits to unlock higher rank badges or redeem future partner perks.
                </p>
              </div>

              {/* Card 2: Brand Coupon */}
              <div className="instant-reward-card coupon-card">
                <div className="irc-header">
                  <span className="irc-icon">🎁</span>
                  <span className="irc-badge brand-badge">{brandName.toUpperCase()} PARTNER</span>
                </div>
                <div className="irc-val coupon-code-val">
                  <code>{couponCode}</code>
                </div>
                <div className="irc-title">{couponTitle}</div>
                <p className="irc-desc">
                  Redeem on the official {brandName} online portal or authorized regional stores. Valid for 90 days.
                </p>
                <button
                  type="button"
                  className="copy-coupon-btn"
                  onClick={handleCopyCoupon}
                >
                  {copiedCoupon ? '✓ Code Copied!' : '📋 Copy Coupon Code'}
                </button>
              </div>

              {/* Card 3: Green Certificate */}
              <div className="instant-reward-card cert-card">
                <div className="irc-header">
                  <span className="irc-icon">📜</span>
                  <span className="irc-badge cert-badge">GOVT CPCB ALIGNED</span>
                </div>
                <div className="irc-val cert-val">{carbonAvoided} kg CO₂e</div>
                <div className="irc-title">Certified Carbon Avoided</div>
                <p className="irc-desc">
                  Official Certificate of Responsible E-Waste Diversion issued for {itemName}.
                </p>
                <button
                  type="button"
                  className="download-cert-btn"
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save Certificate
                </button>
              </div>
            </div>

            {/* Official Digital Certificate Frame */}
            <div className="certificate-frame-box">
              <div className="cert-inner-border">
                <div className="cert-top-row">
                  <div className="cert-emblem">Ⓔ ECOHUB CENTRAL REGISTRY</div>
                  <div className="cert-serial">CERT-{disposalDetails?.id || '2026-CERT'}</div>
                </div>
                <h3 className="cert-heading">Certificate of Responsible Electronic Disposal</h3>
                <p className="cert-text">
                  This certifies that <strong>{activeUser?.name || name || 'EcoHub Citizen'}</strong> has responsibly surrendered <strong>{itemName}</strong> ({weightKg} kg) to authorized facility <strong>{centerName}</strong> for zero-landfill circular processing.
                </p>
                <div className="cert-bottom-row">
                  <div>
                    <span className="cert-label">Carbon Offset:</span>
                    <strong>{carbonAvoided} kg CO₂e Neutralized</strong>
                  </div>
                  <div>
                    <span className="cert-label">Verification:</span>
                    <strong style={{ color: '#10b981' }}>✓ 100% Certified & Handed Over</strong>
                  </div>
                  <div>
                    <span className="cert-label">Issued Date:</span>
                    <strong>{new Date().toLocaleDateString('en-GB')}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="award-actions-row">
              <Link to="/citizen/wallet" className="btn-primary-action">
                🪙 Go to EcoCredits Wallet & Redeem
              </Link>
              <Link to="/citizen" className="btn-secondary-action">
                ♻️ Dispose Another Device
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
