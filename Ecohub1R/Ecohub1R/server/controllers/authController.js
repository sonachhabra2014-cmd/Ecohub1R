const { db, hashPassword } = require('../db');
const { signToken } = require('../middleware/auth');

function register(req, res) {
  const { name, email, password, role = 'user', brand_code, phone, city } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  try {
    const password_hash = hashPassword(password);
    const insert = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, brand_code)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(name, email, password_hash, role, brand_code || null);
    const userId = Number(result.lastInsertRowid);

    // Create user profile
    db.prepare(`
      INSERT INTO user_profiles (user_id, phone, city, sustainability_level, eco_rank, badges)
      VALUES (?, ?, ?, 'Seed Starter', 1, ?)
    `).run(userId, phone || '', city || 'New Delhi', JSON.stringify(['Seed Starter']));

    // Create user wallet
    db.prepare(`
      INSERT INTO wallets (user_id, ecocredits_balance, total_earned)
      VALUES (?, 0, 0)
    `).run(userId);

    // Automated Email Verification Protocol Simulation
    const { logEmail, createInAppNotification } = require('../services/emailService');
    const verifyToken = require('node:crypto').randomBytes(20).toString('hex');
    const verifyUrl = `http://localhost:5173/verify/${verifyToken}`;
    
    logEmail(
      email,
      name,
      'EcoHub Account Verification & Security Link',
      'user_email_verification',
      `<div style="font-family: -apple-system, sans-serif; padding: 24px; color: #1F2937; background: #F8FAFC;">
        <h2 style="color: #0F9D58; margin-top:0;">Verify Your EcoHub Account</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering on EcoHub — the National Evidence-Based E-Waste Platform. Please confirm your email address by clicking below:</p>
        <div style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #0F9D58; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #64748B;">Verification Link: <a href="${verifyUrl}">${verifyUrl}</a></p>
        <p style="font-size: 12px; color: #94A3B8;">If you did not request this account, please disregard this email.</p>
      </div>`
    );

    createInAppNotification(
      userId,
      'account_verification',
      'Verify Your Email Address',
      'A verification link has been sent to your email. Confirm your account to secure your green rewards.',
      verifyUrl
    );

    const token = signToken({ id: userId, email, role, brand_code: brand_code || null });


    return res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: {
        id: userId,
        name,
        email,
        role,
        brand_code: brand_code || null
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email/ID and password are required' });
  }

  const cleanIdent = email.trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanIdent.toLowerCase());

  // If not found by direct email, check if identifier is a Company ID
  if (!user) {
    const compApp = db.prepare('SELECT official_email FROM company_applications WHERE assigned_company_id = ?').get(cleanIdent);
    if (compApp) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(compApp.official_email.toLowerCase());
    }
  }

  // If still not found, check if identifier is a Collection Centre code
  if (!user) {
    const centre = db.prepare('SELECT email FROM collection_centres WHERE assigned_code = ?').get(cleanIdent);
    if (centre && centre.email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(centre.email.toLowerCase());
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid ID/email or password' });
  }

  const inputHash = hashPassword(password);
  if (user.password_hash !== inputHash) {
    return res.status(401).json({ error: 'Invalid ID/email or password' });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    brand_code: user.brand_code
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      brand_code: user.brand_code
    }
  });
}

function getProfile(req, res) {
  const user = req.user;
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id) || { ecocredits_balance: 0, total_earned: 0 };
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(user.id);

  let badges = ['Seed Starter'];
  try {
    if (profile && profile.badges) {
      badges = JSON.parse(profile.badges);
    }
  } catch (e) {}

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      brand_code: user.brand_code
    },
    profile: {
      phone: profile?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      pincode: profile?.pincode || '',
      sustainability_level: profile?.sustainability_level || 'Seed Starter',
      eco_rank: profile?.eco_rank || 1,
      badges
    },
    wallet,
    notifications
  });
}

function sendOTP(req, res) {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Email or phone number required' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    db.prepare(`
      INSERT INTO otps (identifier, otp_code, expires_at, verified)
      VALUES (?, ?, ?, 0)
    `).run(cleanId, otpCode, expiresAt);

    const { sendOTPEmail } = require('../services/emailService');
    sendOTPEmail({ recipient: cleanId, otpCode });

    return res.json({
      success: true,
      message: `OTP dispatched to ${cleanId}`
    });
  } catch (err) {
    console.error('Error generating OTP:', err);
    return res.status(500).json({ error: 'Failed to generate OTP' });
  }
}

function verifyOTP(req, res) {
  const { identifier, otp_code } = req.body;
  if (!identifier || !otp_code) {
    return res.status(400).json({ error: 'Identifier and OTP code required' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const cleanOtp = String(otp_code).trim();

  // Allow '123456' as universal test bypass if needed
  if (cleanOtp === '123456') {
    return res.json({ success: true, message: 'OTP verified successfully' });
  }

  const row = db.prepare(`
    SELECT * FROM otps 
    WHERE identifier = ? AND otp_code = ? AND verified = 0
    ORDER BY id DESC LIMIT 1
  `).get(cleanId, cleanOtp);

  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired OTP code' });
  }

  db.prepare('UPDATE otps SET verified = 1 WHERE id = ?').run(row.id);
  return res.json({ success: true, message: 'OTP verified successfully' });
}

function registerWithOTP(req, res) {
  const { name, email, phone, password, otp_code, disposal_id } = req.body;

  if (!name || !email || !password || !otp_code) {
    return res.status(400).json({ error: 'Name, email, password, and OTP are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp_code).trim();
  const otpRow = db.prepare(`
    SELECT * FROM otps
    WHERE identifier = ? AND otp_code = ? AND verified = 0
    ORDER BY id DESC LIMIT 1
  `).get(cleanEmail, cleanOtp);

  if (!otpRow || new Date(otpRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired OTP code' });
  }

  db.prepare('UPDATE otps SET verified = 1 WHERE id = ?').run(otpRow.id);
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

  try {
    let userId;
    if (user) {
      // Existing user: update password if needed
      userId = user.id;
    } else {
      const password_hash = hashPassword(password);
      const insert = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, brand_code)
        VALUES (?, ?, ?, 'user', NULL)
      `);
      const result = insert.run(name, cleanEmail, password_hash);
      userId = Number(result.lastInsertRowid);

      db.prepare(`
        INSERT INTO user_profiles (user_id, phone, city, sustainability_level, eco_rank, badges)
        VALUES (?, ?, 'New Delhi', 'Seed Starter', 1, ?)
      `).run(userId, phone || '', JSON.stringify(['Seed Starter']));

      db.prepare(`
        INSERT INTO wallets (user_id, ecocredits_balance, total_earned)
        VALUES (?, 0, 0)
      `).run(userId);
    }

    // Associate any orphan disposals with this user_id
    if (disposal_id) {
      db.prepare(`
        UPDATE disposals 
        SET user_id = ?, user_name = ?
        WHERE id = ? OR user_email = ?
      `).run(userId, name, disposal_id, cleanEmail);
    } else {
      db.prepare(`
        UPDATE disposals 
        SET user_id = ?, user_name = ?
        WHERE user_email = ? AND (user_id = 0 OR user_id IS NULL)
      `).run(userId, name, cleanEmail);
    }

    // Check if any verified disposal warrants instant rewards
    try {
      const verifiedDisposal = db.prepare(`
        SELECT * FROM disposals 
        WHERE user_id = ? AND status = 'Received at Collection Centre'
        ORDER BY id DESC LIMIT 1
      `).get(userId);

      if (verifiedDisposal) {
        let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
        if (!wallet) {
          db.prepare('INSERT INTO wallets (user_id, ecocredits_balance, total_earned) VALUES (?, 0, 0)').run(userId);
          wallet = { ecocredits_balance: 0, total_earned: 0 };
        }
        const existingCoupon = db.prepare('SELECT id FROM coupons WHERE user_id = ?').get(userId);
        if (!existingCoupon) {
          const newBal = (wallet.ecocredits_balance || 0) + 10;
          const newTot = (wallet.total_earned || 0) + 10;
          db.prepare('UPDATE wallets SET ecocredits_balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newBal, newTot, userId);
          db.prepare('INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, 10, "disposal_reward", ?)').run(
            userId,
            `100% Instant Reward: Verified drop-off for ${verifiedDisposal.item_name} (${verifiedDisposal.id})`
          );

          const couponRand = Math.floor(100000 + Math.random() * 900000);
          const brandPrefix = (verifiedDisposal.brand_code || 'ECO').toUpperCase();
          const couponCode = `${brandPrefix}-RECYCLE-2026-${couponRand}`;
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + 90);
          const expiryStr = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

          db.prepare(`
            INSERT INTO coupons (user_id, brand_code, brand_name, code, discount_title, discount_description, expiry_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
          `).run(
            userId,
            verifiedDisposal.brand_code || 'ecohub-partner',
            verifiedDisposal.brand_name || 'EcoHub Certified Brand Partner',
            couponCode,
            `₹500 / 15% OFF Official Partner Voucher`,
            `Exclusive green discount voucher unlocked for verified e-waste disposal of ${verifiedDisposal.item_name}.`,
            expiryStr
          );
        }
      }
    } catch (e) {
      console.error('Error auto-crediting rewards on OTP registration:', e);
    }

    const token = signToken({ id: userId, email: cleanEmail, role: 'user', brand_code: null });

    return res.status(201).json({
      message: 'Account verified and registered successfully!',
      token,
      user: {
        id: userId,
        name,
        email: cleanEmail,
        role: 'user'
      }
    });
  } catch (err) {
    console.error('Error in registerWithOTP:', err);
    return res.status(500).json({ error: 'Failed to complete registration' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  sendOTP,
  verifyOTP,
  registerWithOTP
};
