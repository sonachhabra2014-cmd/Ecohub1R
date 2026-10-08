import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';

function GamificationHub() {
  const [gamificationData, setGamificationData] = useState({
    user_stats: {
      level: 'Eco Initiate',
      rank: null,
      total_credits: 0,
      active_balance: 0,
      badges: []
    },
    all_badges: [],
    leaderboard: [],
    monthly_challenges: []
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
            <p className="spotlight-sub">{gamificationData.user_stats.rank ? `Rank #${gamificationData.user_stats.rank}` : 'No verified rank yet'} &bull; {gamificationData.user_stats.total_credits} AI-verified EcoCredits</p>
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
              <span className="badge-pill">AI-verified only</span>
            </div>

            <div className="challenges-list">
              {gamificationData.monthly_challenges.length === 0 ? (
                <p>No additional challenges are active.</p>
              ) : gamificationData.monthly_challenges.map((ch) => (
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
