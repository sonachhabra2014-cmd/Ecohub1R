import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';

function GamificationHub() {
  const [gamificationData, setGamificationData] = useState({
    user_stats: {
      level: 'Eco Champion',
      rank: 4,
      total_credits: 10,
      active_balance: 10,
      badges: ['Eco Initiate', 'Green Guardian', 'Eco Champion']
    },
    all_badges: [
      { name: 'Eco Initiate', icon: '♻️', description: 'Submitted your first verified e-waste disposal', unlocked: true },
      { name: 'Green Guardian', icon: '🛡️', description: 'Reached 5 verified EcoCredits — 5+ kg diverted from landfill', unlocked: true },
      { name: 'Eco Champion', icon: '🏆', description: 'Reached 10 verified EcoCredits & unlocked an exclusive brand coupon', unlocked: true },
      { name: 'Planet Protector', icon: '🌍', description: 'Diverted 25+ kg of verified e-waste from landfill', unlocked: false }
    ],
    leaderboard: [
      { name: 'Sunil Verma', city: 'New Delhi', sustainability_level: 'Planet Protector', credits: 28 },
      { name: 'Pooja Nair', city: 'Bengaluru', sustainability_level: 'Planet Protector', credits: 24 },
      { name: 'Rohit Kulkarni', city: 'Mumbai', sustainability_level: 'Eco Champion', credits: 16 },
      { name: 'Arun Sharma (You)', city: 'New Delhi', sustainability_level: 'Eco Champion', credits: 10 },
      { name: 'Ananya Roy', city: 'Gurugram', sustainability_level: 'Green Guardian', credits: 8 },
      { name: 'Vikas Gupta', city: 'Noida', sustainability_level: 'Green Guardian', credits: 6 }
    ],
    monthly_challenges: [
      {
        id: 1,
        title: 'October E-Waste Zero Sprint',
        description: 'Dispose 2 verified electronic devices at accredited collection centres.',
        reward: '2 Extra EcoCredits + Circuit Breaker Badge',
        deadline: '31 October 2026',
        progress: '1/2 Complete'
      },
      {
        id: 2,
        title: 'Community Green Champion',
        description: 'Invite 3 colleagues or neighbours to responsibly recycle e-waste on EcoHub.',
        reward: '₹500 Brand Voucher + Planet Protector Rank Boost',
        deadline: '15 November 2026',
        progress: '2/3 Invited'
      }
    ]
  });

  useEffect(() => {
    apiRequest('/api/ecocredits/gamification')
      .then(data => {
        if (data && data.user_stats) setGamificationData(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="gamification-page-wrapper">
      {/* HEADER */}
      <div className="gamification-header">
        <span className="step-badge">SUSTAINABILITY GAMIFICATION</span>
        <h1>🏆 Eco Warrior Ranks & Achievement Badges</h1>
        <p>
          Celebrate your environmental milestones. Compete on community leaderboards and conquer monthly eco-challenges.
        </p>
      </div>

      {/* USER RANK SPOTLIGHT */}
      <div className="rank-spotlight-card">
        <div className="spotlight-left">
          <div className="badge-glow-avatar">🏆</div>
          <div>
            <span className="spotlight-tag">YOUR CURRENT STANDING</span>
            <h2>{gamificationData.user_stats.level}</h2>
            <p className="spotlight-sub">Rank #{gamificationData.user_stats.rank} in Northern Region &bull; {gamificationData.user_stats.total_credits} Lifetime EcoCredits</p>
          </div>
        </div>

        <div className="spotlight-right">
          <div className="mini-stat">
            <span className="stat-num">{gamificationData.user_stats.badges.length} / 4</span>
            <span className="stat-desc">Badges Unlocked</span>
          </div>
          <div className="mini-stat">
            <span className="stat-num">{gamificationData.user_stats.active_balance}</span>
            <span className="stat-desc">Wallet Balance</span>
          </div>
        </div>
      </div>

      {/* ACHIEVEMENT BADGES GRID */}
      <div className="badges-section">
        <div className="section-title-wrapper">
          <span className="step-num">★</span>
          <h2>Achievement Badges</h2>
        </div>

        <div className="badges-grid-cards">
          {gamificationData.all_badges.map((badge, idx) => (
            <div
              key={idx}
              className={`badge-card-box ${badge.unlocked ? 'unlocked' : 'locked'}`}
            >
              <div className="badge-icon-wrap">
                <span className="badge-big-icon">{badge.icon}</span>
                {badge.unlocked ? (
                  <span className="unlocked-stamp">✓ UNLOCKED</span>
                ) : (
                  <span className="locked-stamp">🔒 LOCKED</span>
                )}
              </div>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TWO COLUMNS: LEADERBOARD & MONTHLY CHALLENGES */}
      <div className="game-two-columns">
        {/* LEADERBOARD */}
        <div className="leaderboard-col">
          <div className="game-card">
            <div className="card-header-flex">
              <h3>🌍 Community Eco Leaderboard</h3>
              <span className="realtime-pill">Live Rankings</span>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="ecohub-data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Eco-Warrior</th>
                    <th>City</th>
                    <th>Level</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {gamificationData.leaderboard.map((user, idx) => {
                    const isYou = user.name.includes('(You)');

                    return (
                      <tr key={idx} className={isYou ? 'row-user-highlight' : ''}>
                        <td>
                          <span className={`rank-number-tag ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td>
                          <strong>{user.name}</strong>
                        </td>
                        <td>{user.city}</td>
                        <td>
                          <span className="level-chip">{user.sustainability_level}</span>
                        </td>
                        <td>
                          <strong className="positive-amount">{user.credits}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MONTHLY CHALLENGES */}
        <div className="challenges-col">
          <div className="game-card">
            <div className="card-header-flex">
              <h3>🎯 Active Monthly Challenges</h3>
              <span className="badge-pill">September 2026</span>
            </div>

            <div className="challenges-list">
              {gamificationData.monthly_challenges.map((ch) => (
                <div key={ch.id} className="monthly-challenge-item">
                  <div className="ch-top">
                    <h4>{ch.title}</h4>
                    <span className="deadline-tag">Ends {ch.deadline}</span>
                  </div>
                  <p className="ch-desc">{ch.description}</p>
                  
                  <div className="ch-reward-box">
                    <span>🎁 Reward:</span>
                    <strong>{ch.reward}</strong>
                  </div>

                  <div className="ch-progress-row">
                    <span>Progress: {ch.progress}</span>
                    <div className="progress-mini-track">
                      <div className="progress-mini-fill" style={{ width: ch.progress.startsWith('1') ? '50%' : '66%' }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GamificationHub;
