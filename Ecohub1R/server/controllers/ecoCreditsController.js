const crypto = require('node:crypto');
const { db } = require('../db');
const { verifyPlantingVideo } = require('../services/videoVerificationService');
const { sendAIVerificationEmail } = require('../services/emailService');
const { signToken, verifyToken } = require('../middleware/auth');

const VIDEO_CHALLENGES = [
  'Show the EcoBag QR beside the item, then move the camera to the right side.',
  'Keep the EcoBag QR visible and tilt the camera to show the opposite side of the item.',
  'Show the EcoBag QR, then move closer to the product label without stopping the recording.'
];

function validateChallengeAccess(req, disposalId, accessToken) {
  const access = verifyToken(accessToken);
  if (!access || access.type !== 'eco_challenge' || access.disposal_id !== disposalId) {
    return false;
  }
  return String(access.user_id) === String(req.user.id);
}

function getVideoChallenge(req, res) {
  const { disposal_id, access_token } = req.query;
  if (!disposal_id || !validateChallengeAccess(req, disposal_id, access_token)) {
    return res.status(403).json({ error: 'Open the video challenge from the email for this disposal.' });
  }

  const disposal = db.prepare('SELECT * FROM disposals WHERE id = ? AND user_id = ?').get(disposal_id, req.user.id);
  if (!disposal || disposal.verification_status !== 'VERIFIED' || Number(disposal.is_locked) !== 1) {
    return res.status(403).json({ error: 'The product must pass collection-centre AI verification before the video challenge.' });
  }

  const challengeText = VIDEO_CHALLENGES[crypto.randomInt(VIDEO_CHALLENGES.length)];
  const challengeId = crypto.randomUUID();
  const challengeToken = signToken({
    type: 'eco_video_challenge',
    challenge_id: challengeId,
    challenge_text: challengeText,
    user_id: req.user.id,
    disposal_id
  }, 15 * 60);

  return res.json({ challenge_id: challengeId, challenge_text: challengeText, challenge_token: challengeToken });
}

async function submitChallenge(req, res) {
  const {
    disposal_id,
    access_token,
    challenge_token,
    capture_method,
    capture_metadata,
    filename = '',
    mime_type = '',
    video_data = '',
    user_notes = ''
  } = req.body;

  if (!disposal_id) {
    return res.status(400).json({ error: 'Disposal ID is required' });
  }

  if (!validateChallengeAccess(req, disposal_id, access_token)) {
    return res.status(403).json({ error: 'Open this plant challenge from the verification email for this bag.' });
  }

  const challenge = verifyToken(challenge_token);
  if (!challenge || challenge.type !== 'eco_video_challenge' ||
      challenge.disposal_id !== disposal_id ||
      String(challenge.user_id) !== String(req.user.id)) {
    return res.status(403).json({ error: 'The live-video challenge is invalid or expired. Request a new challenge.' });
  }

  const hasCaptureMetadata = capture_method === 'live_camera' &&
    capture_metadata?.capture_method === 'live_camera' &&
    Number.isFinite(Number(capture_metadata.gps_lat)) &&
    Number.isFinite(Number(capture_metadata.gps_lng)) &&
    Number.isFinite(Date.parse(capture_metadata.captured_at)) &&
    typeof capture_metadata.device_id === 'string' &&
    capture_metadata.device_id.length >= 8 &&
    typeof capture_metadata.device_info?.user_agent === 'string';
  if (!hasCaptureMetadata || !video_data || !mime_type) {
    return res.status(400).json({ error: 'A live camera recording with GPS, timestamp, and device metadata is required.' });
  }

  const disposal = db.prepare('SELECT * FROM disposals WHERE id = ? AND user_id = ?').get(disposal_id, req.user.id);
  if (!disposal) {
    return res.status(404).json({ error: `Disposal ID "${disposal_id}" not found` });
  }

  if (!['Verified Waste Record Created', 'Received at Collection Centre'].includes(disposal.status) ||
      disposal.verification_status !== 'VERIFIED' || Number(disposal.is_locked) !== 1) {
    return res.status(400).json({
      error: 'The product must pass collection-centre AI verification before the video challenge is available.'
    });
  }

  if (!video_data || !filename || !mime_type) {
    return res.status(400).json({ error: 'An actual video file is required; filename and size metadata are not evidence.' });
  }

  const priorApproval = db.prepare("SELECT id FROM challenges WHERE disposal_id = ? AND status = 'Approved'").get(disposal_id);
  if (priorApproval) {
    return res.status(409).json({ error: 'This disposal already has an approved video challenge.' });
  }

  try {
    const aiResult = await verifyPlantingVideo({
      videoData: video_data,
      mimeType: mime_type,
      filename,
      challengeText: challenge.challenge_text,
      captureMetadata,
      userNotes: user_notes,
      existingDisposalId: disposal_id
    });

    if (!aiResult.available) {
      return res.status(503).json({ error: aiResult.error || 'Video AI verification is unavailable. No score or credits were generated.' });
    }

    const isApproved = aiResult.status === 'Approved';

    // Insert challenge record with Government CPCB/EPR forensic trail
    const insert = db.prepare(`
      INSERT INTO challenges (
        disposal_id, user_id, video_filename, video_format, status,
        plant_detected, watering_detected, authenticity_score, duration_seconds,
        soil_score, water_dynamics_score, anti_tamper_score,
        gov_compliance_id, gov_compliance_hash, gov_audit_notes,
        ai_notes, submitted_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insert.run(
      disposal_id,
      req.user.id,
      filename,
      mime_type.toUpperCase(),
      aiResult.status,
      aiResult.plant_detected,
      aiResult.watering_detected,
      aiResult.authenticity_score,
      aiResult.duration_seconds || 0,
      aiResult.soil_score || 0,
      aiResult.water_dynamics_score || 0,
      aiResult.anti_tamper_score || 0,
      aiResult.verification_reference_id || null,
      aiResult.gov_compliance_hash || aiResult.video_hash || null,
      aiResult.gov_audit_notes || null,
      aiResult.ai_notes
    );

    const getVerifiedVideoCredits = () => Number(db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM wallet_transactions
      WHERE user_id = ? AND type = 'challenge_reward'
        AND description LIKE 'AI-approved EcoBag video challenge%'
    `).get(req.user.id).total) || 0;

    if (isApproved) {
      const rewardPoints = aiResult.reward_points;
      if (![1, 10].includes(rewardPoints)) {
        throw new Error('Video verifier returned an invalid reward tier');
      }

      if (!db.prepare('SELECT user_id FROM wallets WHERE user_id = ?').get(req.user.id)) {
        db.prepare('INSERT INTO wallets (user_id, ecocredits_balance, total_earned) VALUES (?, 0, 0)').run(req.user.id);
      }

      // 1. Update this specific plant/bag's daily progress
      const currentDays = disposal.plant_day_count || 0;
      const newPlantDays = currentDays + 1;
      const todayStr = new Date().toISOString().slice(0, 10);

      db.prepare(`
        UPDATE disposals 
        SET plant_day_count = ?, last_watered_date = ?
        WHERE id = ?
      `).run(newPlantDays, todayStr, disposal_id);

      const newBalance = getVerifiedVideoCredits() + rewardPoints;
      const newTotal = newBalance;

      db.prepare(`
        UPDATE wallets 
        SET ecocredits_balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBalance, newTotal, req.user.id);

      db.prepare(`
        INSERT INTO wallet_transactions (user_id, amount, type, description)
        VALUES (?, ?, 'challenge_reward', ?)
      `).run(req.user.id, rewardPoints, `AI-approved EcoBag video challenge for ${disposal_id}`);

      updateUserGamification(req.user.id, newTotal);

      sendAIVerificationEmail({
        userEmail: req.user.email,
        userName: req.user.name,
        disposalId: disposal_id,
        status: 'Approved',
        creditsEarned: rewardPoints,
        notes: aiResult.ai_notes,
        userId: req.user.id
      });
    }

    const verifiedCredits = getVerifiedVideoCredits();

    return res.json({
      message: isApproved
        ? `Video AI review approved. ${aiResult.reward_points} EcoCredits awarded.`
        : 'Video AI review rejected this submission. No EcoCredits were awarded.',
      ai_result: aiResult,
      wallet: {
        ecocredits_balance: verifiedCredits,
        total_earned: verifiedCredits,
        progress_to_next_reward: (verifiedCredits % 10) / 10
      }
    });
  } catch (err) {
    console.error('Error in challenge submission:', err);
    return res.status(500).json({ error: 'Failed to evaluate challenge submission' });
  }
}

function updateUserGamification(userId, totalCredits) {
  let level = 'Eco Initiate';
  let badges = ['Eco Initiate'];

  if (totalCredits >= 20) {
    level = 'Planet Protector';
    badges = ['Eco Initiate', 'Green Guardian', 'Eco Champion', 'Planet Protector'];
  } else if (totalCredits >= 10) {
    level = 'Eco Champion';
    badges = ['Eco Initiate', 'Green Guardian', 'Eco Champion'];
  } else if (totalCredits >= 5) {
    level = 'Green Guardian';
    badges = ['Eco Initiate', 'Green Guardian'];
  }

  db.prepare(`
    UPDATE user_profiles 
    SET sustainability_level = ?, badges = ?
    WHERE user_id = ?
  `).run(level, JSON.stringify(badges), userId);
}

function getWallet(req, res) {
  const verifiedCredits = Number(db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM wallet_transactions
    WHERE user_id = ? AND type = 'challenge_reward'
      AND description LIKE 'AI-approved EcoBag video challenge%'
  `).get(req.user.id).total) || 0;

  const transactions = db.prepare(`
    SELECT * FROM wallet_transactions 
    WHERE user_id = ? AND type = 'challenge_reward'
      AND description LIKE 'AI-approved EcoBag video challenge%'
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);

  let badges = ['Eco Initiate'];
  try {
    if (profile && profile.badges) badges = JSON.parse(profile.badges);
  } catch (e) {}

  return res.json({
    wallet: {
      balance: verifiedCredits,
      total_earned: verifiedCredits,
      progress_to_next_milestone: (verifiedCredits % 10) / 10
    },
    transactions,
    badges,
    sustainability_level: profile?.sustainability_level || 'Eco Initiate',
    eco_rank: profile?.eco_rank || 1
  });
}

function getGamification(req, res) {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
  const verifiedCredits = Number(db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM wallet_transactions
    WHERE user_id = ? AND type = 'challenge_reward'
      AND description LIKE 'AI-approved EcoBag video challenge%'
  `).get(req.user.id).total) || 0;

  const leaderboard = db.prepare(`
    SELECT u.id, u.name, p.city, SUM(t.amount) as credits
    FROM users u
    JOIN user_profiles p ON u.id = p.user_id
    JOIN wallet_transactions t ON u.id = t.user_id
    WHERE u.role = 'user'
      AND t.type = 'challenge_reward'
      AND t.description LIKE 'AI-approved EcoBag video challenge%'
    GROUP BY u.id, u.name, p.city
    ORDER BY credits DESC
    LIMIT 10
  `).all();

  const level = verifiedCredits >= 20 ? 'Planet Protector'
    : verifiedCredits >= 10 ? 'Eco Champion'
      : verifiedCredits >= 5 ? 'Green Guardian'
        : 'Eco Initiate';
  const badges = ['Eco Initiate'];
  if (verifiedCredits >= 5) badges.push('Green Guardian');
  if (verifiedCredits >= 10) badges.push('Eco Champion');
  if (verifiedCredits >= 20) badges.push('Planet Protector');
  const ownRank = leaderboard.findIndex(user => Number(user.id) === Number(req.user.id));

  return res.json({
    user_stats: {
      level,
      rank: ownRank < 0 ? null : ownRank + 1,
      total_credits: verifiedCredits,
      active_balance: verifiedCredits,
      badges
    },
    all_badges: [
      { name: 'Eco Initiate', icon: '♻️', description: 'First AI-approved challenge point', unlocked: badges.includes('Eco Initiate') },
      { name: 'Green Guardian', icon: '🛡️', description: 'Reached 5 AI-verified EcoCredits', unlocked: badges.includes('Green Guardian') },
      { name: 'Eco Champion', icon: '🏆', description: 'Reached 10 AI-verified EcoCredits', unlocked: badges.includes('Eco Champion') },
      { name: 'Planet Protector', icon: '🌍', description: 'Reached 20 AI-verified EcoCredits', unlocked: badges.includes('Planet Protector') }
    ],
    leaderboard,
    monthly_challenges: []
  });
}

function getUserPlants(req, res) {
  const requestedDisposalId = req.query.disposal_id;
  const accessToken = req.query.access_token;
  if (!requestedDisposalId || !validateChallengeAccess(req, requestedDisposalId, accessToken)) {
    return res.status(403).json({ error: 'Open this plant challenge from the verification email for this bag.' });
  }

  const disposals = db.prepare(`
    SELECT d.*, c.name as company_full_name
    FROM disposals d
    LEFT JOIN companies c ON d.brand_code = c.brand_code
    WHERE d.id = ? AND (d.user_id = ? OR d.user_email = ?)
    ORDER BY d.created_at DESC
  `).all(requestedDisposalId, req.user.id, req.user.email);

  const todayStr = new Date().toISOString().slice(0, 10);
  const plants = disposals.map(d => {
    const days = d.plant_day_count || 0;
    const isWateredToday = d.last_watered_date === todayStr;
    return {
      disposal_id: d.id,
      bag_id: d.bag_id || `BAG-${(d.brand_code || 'ECO').toUpperCase()}-2026-${d.id.slice(-4)}`,
      item_name: d.item_name,
      category: d.category,
      brand_code: d.brand_code,
      brand_name: d.brand_name || d.company_full_name || 'EcoHub Partner',
      seed_type: d.seed_type || 'Tulsi & Organic Marigold Seeds',
      collection_centre_name: d.collection_centre_name,
      status: d.status,
      is_received: d.status === 'Received at Collection Centre',
      plant_day_count: days,
      target_days: 10,
      progress_percent: Math.min(100, Math.round((days / 10) * 100)),
      last_watered_date: d.last_watered_date,
      is_watered_today: isWateredToday
    };
  });

  return res.json(plants);
}

module.exports = {
  submitChallenge,
  getVideoChallenge,
  getUserPlants,
  getWallet,
  getGamification
};
