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

  const brandName = disposalDetails?.brand_name || 'EcoHub Partner';
  const itemName = disposalDetails?.item_name || 'Recycled Electronic Device';
  const centerName = disposalDetails?.centre_name || disposalDetails?.collection_centre_name || 'Authorized Drop-off Facility';
  const verifiedAtCentre = ['Received at Collection Centre', 'Verified Waste Record Created'].includes(disposalDetails?.status);
  const challengeRewardPoints = Number(disposalDetails?.challenge_reward_points) || 0;
  const hasVideoReward = disposalDetails?.challenge_status === 'Approved' &&
    disposalDetails?.challenge_verification_reference === 'ECOHUB_VIDEO_AI_V1' &&
    challengeRewardPoints > 0;
  const weightKg = disposalDetails?.estimated_weight_kg || 1.2;

  return (
    <div className="claim-award-container">
      <div className="claim-award-card">
        <div className="award-top-badge">
          EcoHub AI Video Verification
        </div>

        <h1 className="award-title">
          Responsible Disposal <span>Reward Portal</span>
        </h1>
        <p className="award-subtitle">
          {hasVideoReward
            ? `Your submitted video passed AI review. ${challengeRewardPoints} EcoCredits were recorded.`
            : verifiedAtCentre
              ? 'The collection centre recorded receipt. EcoCredits remain locked until your challenge video passes AI review.'
              : 'EcoCredits remain locked until the collection centre and the required video challenge are verified.'}
        </p>

        {!isAuthenticated ? (
          /* Step 1: Verification & Registration Modal */
          <div className="auth-box">
            <div className="auth-box-header">
              <span style={{ fontSize: '1.8rem' }}>🔐</span>
              <div>
                <h3>Verify your EcoBag challenge</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b949e' }}>
                  Verify your email to access the challenge. Credits are awarded only after real video evidence passes AI review.
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
                {submitting ? 'Verifying Identity...' : 'Verify identity to continue'}
              </button>
            </form>
          </div>
        ) : !hasVideoReward ? (
          <div className="reveal-wrapper">
            <div className="status-banner">
              <div>
                <strong style={{ color: '#ffffff', display: 'block', fontSize: '1rem' }}>
                  {itemName} ({brandName})
                </strong>
                <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                  Record: <code style={{ color: '#34d399' }}>{disposalDetails?.id || disposalParam}</code>
                </span>
              </div>
              <div className="status-badge-verified">
                {verifiedAtCentre ? 'Received at centre' : 'Awaiting verification'}
              </div>
            </div>
            <div className="instant-reward-hero">
              <h2>EcoCredits are still locked</h2>
              <p>Centre receipt alone does not earn points. Submit the requested video and wait for an actual AI review. No coupon or estimated score is issued.</p>
              <Link to={`/citizen/challenge?disposal_id=${encodeURIComponent(disposalDetails?.id || disposalParam)}&access=${encodeURIComponent(accessParam)}`} className="btn-primary-action">
                Open video challenge
              </Link>
            </div>
            <div className="award-actions-row">
              <Link to="/citizen" className="btn-secondary-action">Dispose another item</Link>
            </div>
          </div>
        ) : (
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
              <div className="status-badge-verified">✓ AI video approved</div>
            </div>

            {/* Instant Reward Celebration Banner */}
            <div className="instant-reward-hero">
              <div className="icon-large">🏆✨</div>
              <h2>+{challengeRewardPoints} EcoCredits earned</h2>
              <p>
                The submitted challenge video passed the configured AI verification checks. These points are recorded in your wallet; no coupons are issued.
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
                <div className="irc-val">+{challengeRewardPoints} EcoCredits</div>
                <div className="irc-title">Credited to Your Wallet</div>
                <p className="irc-desc">
                  Points were recorded only after the challenge video received an approved AI review.
                </p>
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
