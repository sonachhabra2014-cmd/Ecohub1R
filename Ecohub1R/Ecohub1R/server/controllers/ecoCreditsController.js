const { db } = require('../db');
const { verifyPlantingVideo } = require('../services/aiVerificationService');
const { sendRewardCouponEmail, sendAIVerificationEmail } = require('../services/emailService');
const { verifyToken } = require('../middleware/auth');

const DEMO_REWARD = {
  title: 'EcoHub Demo Reward: Cashback / Coupon Pending',
  description: 'This is a demo reward shown after 10 verified EcoCredits. Coupon/cashback format will be finalized later.',
  prefix: 'ECOHUB-DEMO'
};

function validateChallengeAccess(req, disposalId, accessToken) {
  const access = verifyToken(accessToken);
  if (!access || access.type !== 'eco_challenge' || access.disposal_id !== disposalId) {
    return false;
  }
  return String(access.user_id) === String(req.user.id);
}

async function submitChallenge(req, res) {
  const {
    disposal_id,
    access_token,
    filename = 'plantation_video.mp4',
    format = 'MP4',
    duration_seconds = 6.0,
    file_size_mb = 12.5,
    user_notes = ''
  } = req.body;

  if (!disposal_id) {
    return res.status(400).json({ error: 'Disposal ID is required' });
  }

  if (!validateChallengeAccess(req, disposal_id, access_token)) {
    return res.status(403).json({ error: 'Open this plant challenge from the verification email for this bag.' });
  }

  const disposal = db.prepare('SELECT * FROM disposals WHERE id = ? AND user_id = ?').get(disposal_id, req.user.id);
  if (!disposal) {
    return res.status(404).json({ error: `Disposal ID "${disposal_id}" not found` });
  }

  // Ensure disposal is verified at centre
  if (disposal.status !== 'Received at Collection Centre') {
    return res.status(400).json({
      error: 'E-Waste item must first be verified & received at the Collection Centre before completing the EcoCredit challenge.'
    });
  }

  try {
    // Run AI Verification Engine
    const aiResult = await verifyPlantingVideo({
      filename,
      format,
      fileSize: file_size_mb,
      durationSeconds: parseFloat(duration_seconds),
      userNotes: user_notes,
      existingDisposalId: disposal_id
    });

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
      format.toUpperCase(),
      aiResult.status,
      aiResult.plant_detected,
      aiResult.watering_detected,
      aiResult.authenticity_score,
      aiResult.duration_seconds,
      aiResult.soil_score || 0,
      aiResult.water_dynamics_score || 0,
      aiResult.anti_tamper_score || 0,
      aiResult.gov_compliance_id || null,
      aiResult.gov_compliance_hash || null,
      aiResult.gov_audit_notes || null,
      aiResult.ai_notes
    );

    let newlyUnlockedCoupon = null;
    let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);

    if (isApproved) {
      // 1. Update this specific plant/bag's daily progress
      const currentDays = disposal.plant_day_count || 0;
      const newPlantDays = currentDays + 1;
      const todayStr = new Date().toISOString().slice(0, 10);

      db.prepare(`
        UPDATE disposals 
        SET plant_day_count = ?, last_watered_date = ?
        WHERE id = ?
      `).run(newPlantDays, todayStr, disposal_id);

      // 2. 1 approved challenge = 1 EcoCredit in global wallet
      const newBalance = wallet.ecocredits_balance + 1;
      const newTotal = wallet.total_earned + 1;

      db.prepare(`
        UPDATE wallets 
        SET ecocredits_balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBalance, newTotal, req.user.id);

      // Record transaction
      db.prepare(`
        INSERT INTO wallet_transactions (user_id, amount, type, description)
        VALUES (?, 1, 'challenge_reward', ?)
      `).run(req.user.id, `Day ${newPlantDays}/10 verified seed watering for ${disposal_id}`);

      // Check Gamification Badges & Levels
      updateUserGamification(req.user.id, newTotal);

      // 3. AUTOMATIC COUPON UNLOCK: When this specific plant reaches 10 days (or balance reaches 10)
      if (newPlantDays >= 10 || newBalance >= 10) {
        const couponRand = Math.floor(100000 + Math.random() * 900000);
        const couponCode = `${DEMO_REWARD.prefix}-2026-${couponRand}`;

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 90);
        const expiryStr = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        db.prepare(`
          INSERT INTO coupons (user_id, brand_code, brand_name, code, discount_title, discount_description, expiry_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(
          req.user.id,
          'ecohub-demo',
          'EcoHub Demo Partner',
          couponCode,
          DEMO_REWARD.title,
          DEMO_REWARD.description,
          expiryStr
        );

        newlyUnlockedCoupon = {
          code: couponCode,
          brand_name: 'EcoHub Demo Partner',
          discount_title: DEMO_REWARD.title,
          expiry_date: expiryStr
        };

        // Dispatch REWARD EMAIL
        sendRewardCouponEmail({
          userEmail: req.user.email,
          userName: req.user.name,
          brandName: disposal.brand_name || 'Brand Partner',
          couponCode,
          discountTitle: DEMO_REWARD.title,
          expiryDate: expiryStr,
          userId: req.user.id
        });
      }

      // Dispatch AI Verification Result Email
      sendAIVerificationEmail({
        userEmail: req.user.email,
        userName: req.user.name,
        disposalId: disposal_id,
        status: 'Approved',
        creditsEarned: 1,
        notes: aiResult.ai_notes,
        userId: req.user.id
      });
    }

    // Refresh wallet
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);

    return res.json({
      message: isApproved
        ? 'Seed planting video verified by AI! 1 EcoCredit awarded to your wallet.'
        : 'AI verification could not validate the video submission.',
      ai_result: aiResult,
      wallet: {
        ecocredits_balance: wallet.ecocredits_balance,
        total_earned: wallet.total_earned,
        progress_to_next_coupon: (wallet.ecocredits_balance % 10) / 10
      },
      newly_unlocked_coupon: newlyUnlockedCoupon
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
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id) || {
    ecocredits_balance: 0,
    total_earned: 0
  };

  const transactions = db.prepare(`
    SELECT * FROM wallet_transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);

  const coupons = db.prepare(`
    SELECT * FROM coupons 
    WHERE user_id = ? 
    ORDER BY unlocked_at DESC
  `).all(req.user.id);

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);

  let badges = ['Eco Initiate'];
  try {
    if (profile && profile.badges) badges = JSON.parse(profile.badges);
  } catch (e) {}

  return res.json({
    wallet: {
      balance: wallet.ecocredits_balance,
      total_earned: wallet.total_earned,
      progress_to_next_coupon: (wallet.ecocredits_balance % 10) / 10,
      credits_until_next_coupon: 10 - (wallet.ecocredits_balance % 10)
    },
    transactions,
    coupons,
    badges,
    sustainability_level: profile?.sustainability_level || 'Eco Initiate',
    eco_rank: profile?.eco_rank || 1
  });
}

function getGamification(req, res) {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id) || { ecocredits_balance: 0, total_earned: 0 };

  // Leaderboard
  const leaderboard = db.prepare(`
    SELECT u.name, p.city, p.sustainability_level, w.total_earned as credits
    FROM users u
    JOIN user_profiles p ON u.id = p.user_id
    JOIN wallets w ON u.id = w.user_id
    WHERE u.role = 'user'
    ORDER BY w.total_earned DESC
    LIMIT 10
  `).all();

  const monthlyChallenges = [
    {
      id: 1,
      title: 'October E-Waste Zero Sprint',
      description: 'Dispose 2 verified electronic devices at an accredited collection centre.',
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
  ];

  let badges = ['Eco Initiate'];
  try {
    if (profile && profile.badges) badges = JSON.parse(profile.badges);
  } catch (e) {}

  return res.json({
    user_stats: {
      level: profile?.sustainability_level || 'Eco Initiate',
      rank: profile?.eco_rank || 1,
      total_credits: wallet.total_earned,
      active_balance: wallet.ecocredits_balance,
      badges
    },
    all_badges: [
      { name: 'Eco Initiate', icon: '♻️', description: 'Submitted your first verified e-waste disposal', unlocked: badges.includes('Eco Initiate') },
      { name: 'Green Guardian', icon: '🛡️', description: 'Reached 5 verified EcoCredits — 5+ kg diverted from landfill', unlocked: badges.includes('Green Guardian') },
      { name: 'Eco Champion', icon: '🏆', description: 'Reached 10 verified EcoCredits & unlocked an exclusive brand coupon', unlocked: badges.includes('Eco Champion') },
      { name: 'Planet Protector', icon: '🌍', description: 'Diverted 25+ kg of verified e-waste from landfill — top-tier sustainability leader', unlocked: badges.includes('Planet Protector') }
    ],
    leaderboard,
    monthly_challenges: monthlyChallenges
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
    const coupon = db.prepare('SELECT * FROM coupons WHERE user_id = ? AND brand_code = ?').get(req.user.id, d.brand_code);

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
      is_watered_today: isWateredToday,
      unlocked_coupon: coupon || null
    };
  });

  return res.json(plants);
}

module.exports = {
  submitChallenge,
  getUserPlants,
  getWallet,
  getGamification
};
