import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

/* ─────────────────────────────────────────────────────────────────
   ANIMATED CREDIT RING — circular progress indicator
───────────────────────────────────────────────────────────────── */
function CreditRing({ progress, size = 80, strokeWidth = 7, color = '#10b981' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, progress);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function EcoCreditsWallet() {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/ecocredits/wallet');
      if (data && data.wallet) {
        setWalletData(data);
      } else {
        setWalletData(FALLBACK);
      }
    } catch (err) {
      console.warn('Using local wallet fallback:', err);
      setWalletData(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 3000);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem 1rem' }}>
          <div style={styles.spinnerRing} />
          <p style={{ color: '#475569', fontSize: '0.9rem' }}>Loading your EcoCredits wallet…</p>
        </div>
      </div>
    );
  }

  const data = walletData || FALLBACK;
  const { wallet, transactions, coupons, badges, sustainability_level, eco_rank } = data;
  const ringProgress = wallet.balance > 0
    ? (wallet.balance % 10 === 0 ? 1 : (wallet.balance % 10) / 10)
    : 0;

  const LEVEL_CONFIG = {
    'Eco Initiate':    { color: '#64748b', icon: '♻️', next: 5 },
    'Green Guardian':  { color: '#34d399', icon: '🛡️', next: 10 },
    'Eco Champion':    { color: '#fbbf24', icon: '🏆', next: 20 },
    'Planet Protector':{ color: '#a78bfa', icon: '🌍', next: null }
  };
  const levelCfg = LEVEL_CONFIG[sustainability_level] || LEVEL_CONFIG['Eco Initiate'];

  return (
    <div style={styles.page}>
      {/* Ambient glow blobs */}
      <div style={{ ...styles.glow, top: '-100px', left: '-100px', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%)' }} />
      <div style={{ ...styles.glow, bottom: '-80px', right: '-80px', background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 65%)' }} />

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerEyebrow}>REWARDS &amp; WALLET</div>
          <h1 style={styles.headerTitle}>🌱 EcoCredits Wallet</h1>
          <p style={styles.headerSub}>
            Track earned sustainability credits, transaction history, and unlocked corporate brand vouchers.
          </p>
        </div>
        <Link to="/dispose" style={styles.earnBtn}>
          + Recycle &amp; Earn Credits
        </Link>
      </div>

      {/* ── TOP METRICS GRID ──────────────────────────────────── */}
      <div style={styles.metricsGrid}>

        {/* BALANCE CARD */}
        <div style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.92) 100%)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={styles.cardTopRow}>
            <span style={styles.cardLabel}>ACTIVE BALANCE</span>
            <span style={{ fontSize: '1.4rem' }}>🪙</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', margin: '0.75rem 0' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: '#34d399', letterSpacing: '-0.03em' }}>{wallet.balance}</span>
            <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600, paddingBottom: '0.5rem' }}>EcoCredits</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            Lifetime Earned: <strong style={{ color: '#a7f3d0' }}>{wallet.total_earned}</strong>
          </div>
          <div style={{ marginTop: '1rem', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (wallet.balance / 10) * 100)}%`, background: 'linear-gradient(90deg, #059669, #34d399)', borderRadius: '9999px', transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* PROGRESS CARD */}
        <div style={{ ...styles.card }}>
          <div style={styles.cardTopRow}>
            <span style={styles.cardLabel}>REWARD PROGRESS</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '9999px', padding: '3px 10px' }}>🎁 10 Credits = Coupon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', margin: '1rem 0' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <CreditRing progress={ringProgress} size={76} color="#fbbf24" />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{wallet.balance % 10 === 0 && wallet.balance > 0 ? 10 : wallet.balance % 10}</span>
                <span style={{ fontSize: '0.5rem', color: '#64748b' }}>/ 10</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                {wallet.balance >= 10 ? '🎉 Coupon Unlocked!' : `${wallet.credits_until_next_coupon} more credits`}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                {wallet.balance >= 10 ? 'Check your Coupons Locker below.' : 'Complete drop-offs at nearby centres to unlock brand vouchers!'}
              </div>
            </div>
          </div>
        </div>

        {/* RANK CARD */}
        <div style={{ ...styles.card, background: `linear-gradient(135deg, ${levelCfg.color}18 0%, rgba(15,23,42,0.92) 100%)`, border: `1px solid ${levelCfg.color}33` }}>
          <div style={styles.cardTopRow}>
            <span style={styles.cardLabel}>ECO WARRIOR RANK</span>
            <span style={{ fontSize: '0.75rem', color: levelCfg.color, background: `${levelCfg.color}18`, border: `1px solid ${levelCfg.color}33`, borderRadius: '9999px', padding: '3px 10px', fontWeight: 700 }}>Tier #{eco_rank}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.85rem 0' }}>
            <span style={{ fontSize: '2.2rem', filter: `drop-shadow(0 0 12px ${levelCfg.color}80)` }}>{levelCfg.icon}</span>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: levelCfg.color }}>{sustainability_level}</div>
              {levelCfg.next && <div style={{ fontSize: '0.75rem', color: '#475569' }}>{levelCfg.next} credits to next tier</div>}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {badges.map((b, i) => (
              <span key={i} style={{ fontSize: '0.72rem', color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9999px', padding: '2px 8px' }}>✓ {b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── COUPONS LOCKER ────────────────────────────────────── */}
      <div style={styles.section}>
        <div style={styles.sectionHeaderRow}>
          <div>
            <h2 style={styles.sectionTitle}>🎁 Unlocked Brand Coupons ({coupons.length})</h2>
            <p style={styles.sectionSub}>Unlocked automatically upon verified e-waste drop-off. Redeemable on partner stores.</p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '9999px', padding: '4px 12px', fontWeight: 700, height: 'fit-content' }}>🛡️ Partner Verified</span>
        </div>

        {coupons.length === 0 ? (
          <div style={styles.emptyCoupons}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem', filter: 'grayscale(0.3)' }}>🔒</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#475569', fontSize: '1.1rem' }}>No Coupons Unlocked Yet</h3>
            <p style={{ margin: '0 0 1.25rem', color: '#334155', fontSize: '0.875rem', maxWidth: 320 }}>
              Earn {10 - wallet.balance} more EcoCredits by completing verified e-waste drop-offs at certified centres.
            </p>
            <Link to="/dispose" style={{ ...styles.earnBtn, fontSize: '0.88rem', padding: '0.6rem 1.25rem' }}>Start Recycling →</Link>
          </div>
        ) : (
          <div style={styles.couponsGrid}>
            {coupons.map((coupon) => (
              <div key={coupon.id} style={styles.couponCard}>
                {/* Top glow strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)', backgroundSize: '200% 100%', animation: 'shimmer 4s linear infinite' }} />

                <div style={styles.couponLeft}>
                  <div style={styles.couponBrandRow}>
                    <span style={styles.couponBrandTag}>{coupon.brand_name.toUpperCase()}</span>
                    <span style={styles.activePill}>ACTIVE</span>
                  </div>
                  <h4 style={styles.couponTitle}>{coupon.discount_title}</h4>
                  <p style={styles.couponDesc}>{coupon.discount_description}</p>
                  <div style={styles.couponFooter}>
                    Valid until: <strong style={{ color: '#e2e8f0' }}>{coupon.expiry_date}</strong>
                  </div>
                </div>

                {/* Perforated divider */}
                <div style={styles.couponDivider}>
                  <div style={styles.couponNotchTop} />
                  <div style={{ borderLeft: '2px dashed rgba(255,255,255,0.08)', flex: 1 }} />
                  <div style={styles.couponNotchBot} />
                </div>

                <div style={styles.couponRight}>
                  <div style={styles.codeBox}>
                    <div style={styles.codeLabel}>COUPON CODE</div>
                    <div style={styles.codeVal}>{coupon.code}</div>
                  </div>
                  <button
                    style={{ ...styles.copyBtn, ...(copiedCode === coupon.code ? styles.copyBtnCopied : {}) }}
                    onClick={() => handleCopyCode(coupon.code)}
                  >
                    {copiedCode === coupon.code ? '✓ Copied!' : '📋 Copy Code'}
                  </button>
                  <small style={{ fontSize: '0.7rem', color: '#334155', textAlign: 'center' }}>Apply at checkout</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TRANSACTION LEDGER ────────────────────────────────── */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeaderRow, marginBottom: '1rem' }}>
          <h2 style={styles.sectionTitle}>📜 EcoCredits Transaction Ledger</h2>
          <button style={styles.refreshBtn} onClick={loadWallet}>🔄 Refresh</button>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#334155', fontSize: '0.875rem' }}>No transactions yet. Start by recycling e-waste!</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Date & Time', 'Type', 'Description', 'Amount', 'Status'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(tx.created_at).toLocaleString()}</td>
                    <td style={styles.td}>
                      <span style={styles.txTag}>{tx.type.replace(/_/g, ' ').toUpperCase()}</span>
                    </td>
                    <td style={{ ...styles.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</td>
                    <td style={styles.td}>
                      <strong style={{ color: '#34d399', fontWeight: 800 }}>+{tx.amount} 🪙</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusPill}>✓ Credited</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   STYLES OBJECT  (inline-styles for guaranteed encapsulation)
────────────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 80% 50% at 10% 15%, rgba(16,185,129,0.08) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(5,150,105,0.10) 0%, transparent 55%), #080d14',
    color: '#f0f6fc',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '0 1rem 5rem',
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'fixed', width: 500, height: 500,
    borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: '1rem', padding: '2.5rem 0 2rem', maxWidth: 1100, margin: '0 auto',
    position: 'relative', zIndex: 1,
  },
  headerEyebrow: {
    fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase',
    letterSpacing: '0.1em', marginBottom: '0.5rem',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  headerTitle: { margin: '0 0 0.5rem', fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' },
  headerSub: { margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 480 },
  earnBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff',
    textDecoration: 'none', borderRadius: '10px', padding: '0.7rem 1.25rem',
    fontSize: '0.88rem', fontWeight: 700, border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16,185,129,0.35)', transition: 'all 0.25s ease',
    whiteSpace: 'nowrap',
  },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.25rem', maxWidth: 1100, margin: '0 auto 2rem',
    position: 'relative', zIndex: 1,
  },
  card: {
    background: 'rgba(13,20,30,0.88)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(30,41,59,0.8)',
    borderRadius: '18px', padding: '1.5rem',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    position: 'relative', overflow: 'hidden',
  },
  cardTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  cardLabel: { fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' },
  section: {
    maxWidth: 1100, margin: '0 auto 2rem',
    background: 'rgba(13,20,30,0.75)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(30,41,59,0.8)', borderRadius: '20px', padding: '2rem',
    position: 'relative', zIndex: 1,
  },
  sectionHeaderRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  sectionTitle: { margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: 800, color: '#e2e8f0' },
  sectionSub: { margin: 0, color: '#475569', fontSize: '0.85rem' },
  emptyCoupons: {
    textAlign: 'center', padding: '3rem 1rem',
    background: 'rgba(15,23,42,0.5)', borderRadius: '14px', border: '1px dashed rgba(30,41,59,0.8)',
  },
  couponsGrid: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  couponCard: {
    display: 'flex', alignItems: 'stretch',
    background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(16,185,129,0.18)',
    borderRadius: '16px', overflow: 'hidden', position: 'relative',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'box-shadow 0.25s ease, transform 0.25s ease',
  },
  couponLeft: { flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  couponBrandRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  couponBrandTag: { fontSize: '0.7rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.08em', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '9999px', padding: '2px 10px' },
  activePill: { fontSize: '0.65rem', fontWeight: 800, color: '#fff', background: '#059669', borderRadius: '9999px', padding: '2px 8px', letterSpacing: '0.06em' },
  couponTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 },
  couponDesc: { margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 },
  couponFooter: { fontSize: '0.78rem', color: '#475569', marginTop: 'auto', paddingTop: '0.5rem' },
  couponDivider: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0', width: 24, flexShrink: 0, position: 'relative' },
  couponNotchTop: { width: 16, height: 16, borderRadius: '50%', background: '#080d14', marginTop: -8, flexShrink: 0 },
  couponNotchBot: { width: 16, height: 16, borderRadius: '50%', background: '#080d14', marginBottom: -8, flexShrink: 0 },
  couponRight: { padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minWidth: 160 },
  codeBox: { textAlign: 'center', background: 'rgba(8,13,20,0.8)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '0.7rem 1rem', width: '100%' },
  codeLabel: { fontSize: '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' },
  codeVal: { fontFamily: "'Courier New', monospace", fontSize: '0.82rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.06em', wordBreak: 'break-all' },
  copyBtn: {
    width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', border: '1.5px solid rgba(16,185,129,0.35)',
    background: 'rgba(16,185,129,0.1)', color: '#34d399', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  copyBtnCopied: { background: 'rgba(16,185,129,0.25)', borderColor: '#10b981', color: '#6ee7b7' },
  refreshBtn: {
    background: 'rgba(15,23,42,0.8)', color: '#64748b', border: '1px solid rgba(30,41,59,0.8)',
    borderRadius: '8px', padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: {
    padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem',
    color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1px solid rgba(30,41,59,0.8)', whiteSpace: 'nowrap',
  },
  td: { padding: '0.8rem 1rem', color: '#94a3b8', borderBottom: '1px solid rgba(15,23,42,0.6)', verticalAlign: 'middle' },
  tr: { transition: 'background 0.15s ease' },
  txTag: {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
    color: '#7dd3fc', borderRadius: '9999px', padding: '2px 8px',
  },
  statusPill: {
    fontSize: '0.72rem', fontWeight: 700, color: '#34d399',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '9999px', padding: '3px 10px',
  },
  spinnerRing: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid rgba(16,185,129,0.15)',
    borderTopColor: '#10b981',
    animation: 'spin 0.8s linear infinite',
  },
};

/* Fallback data */
const FALLBACK = {
  wallet: { balance: 10, total_earned: 10, progress_to_next_coupon: 1.0, credits_until_next_coupon: 0 },
  transactions: [
    { id: 1, amount: 10, type: 'challenge_reward', description: 'Verified e-waste drop-off reward for DISP-2026-000101', created_at: '2026-09-10 11:45:00' },
    { id: 2, amount: 0, type: 'challenge_reward', description: 'Welcome citizen bonus & green onboarding', created_at: '2026-09-08 14:20:00' }
  ],
  coupons: [
    {
      id: 1, brand_name: 'Samsung Electronics', brand_code: 'samsung',
      code: 'SAMSUNG-2026-789214',
      discount_title: '₹2,500 Off Samsung Galaxy & Smart Eco Devices',
      discount_description: 'Valid on Samsung Online Store on any Eco-certified smartphone, tablet, or monitor.',
      expiry_date: '10 Dec 2026', status: 'active'
    },
    {
      id: 2, brand_name: 'HP Inc.', brand_code: 'hp',
      code: 'HP-ECO-2026-442109',
      discount_title: '15% Off HP Eco Edition Laptops',
      discount_description: 'Instant discount on HP Pavilion Eco Series and recycled cartridge refills.',
      expiry_date: '15 Jan 2027', status: 'active'
    }
  ],
  badges: ['Eco Initiate', 'Green Guardian', 'Eco Champion'],
  sustainability_level: 'Eco Champion',
  eco_rank: 4
};

export default EcoCreditsWallet;
