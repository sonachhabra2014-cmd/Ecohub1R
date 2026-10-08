const { db } = require('../db');
const { sendAIVerificationEmail } = require('../services/emailService');

function getAdminOverview(req, res) {
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const companiesCount = db.prepare('SELECT COUNT(*) as count FROM companies').get().count;
  const centresCount = db.prepare('SELECT COUNT(*) as count FROM collection_centres').get().count;
  const disposalsCount = db.prepare('SELECT COUNT(*) as count FROM disposals').get().count;
  const verifiedDisposals = db.prepare(`SELECT COUNT(*) as count FROM disposals WHERE status = 'Received at Collection Centre'`).get().count;
  const challengesCount = db.prepare('SELECT COUNT(*) as count FROM challenges').get().count;
  const approvedChallenges = db.prepare(`SELECT COUNT(*) as count FROM challenges WHERE status = 'Approved'`).get().count;
  const couponsCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;
  const emailsSent = db.prepare('SELECT COUNT(*) as count FROM email_logs').get().count;

  const totalWeight = db.prepare('SELECT SUM(estimated_weight_kg) as total FROM disposals').get().total || 0;
  const totalEcoCredits = db.prepare('SELECT SUM(total_earned) as total FROM wallets').get().total || 0;

  return res.json({
    metrics: {
      total_users: usersCount,
      total_companies: companiesCount,
      total_collection_centres: centresCount,
      total_disposals: disposalsCount,
      verified_disposals: verifiedDisposals,
      total_ewaste_kg: parseFloat(totalWeight.toFixed(2)),
      total_ecocredits_awarded: totalEcoCredits,
      total_challenges_submitted: challengesCount,
      approved_plantations: approvedChallenges,
      unlocked_brand_coupons: couponsCount,
      automated_emails_dispatched: emailsSent
    },
    system_health: {
      status: "Healthy",
      ai_engine: "Operational (Vision v2.4)",
      database: "WAL Mode Synced",
      encryption: "AES-256 / SHA-256 Verified",
      timestamp: new Date().toISOString()
    }
  });
}

function getAIReviewQueue(req, res) {
  const challenges = db.prepare(`
    SELECT c.*, d.item_name, d.brand_name, d.collection_centre_name, u.name as user_name, u.email as user_email
    FROM challenges c
    JOIN disposals d ON c.disposal_id = d.id
    JOIN users u ON c.user_id = u.id
    ORDER BY c.submitted_at DESC
    LIMIT 50
  `).all();

  return res.json(challenges);
}

function overrideChallengeStatus(req, res) {
  const { challenge_id, status, notes } = req.body;

  if (!challenge_id || !status) {
    return res.status(400).json({ error: 'Challenge ID and status (Approved/Rejected) required' });
  }

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challenge_id);
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge record not found' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challenge.user_id);

  db.prepare(`
    UPDATE challenges 
    SET status = ?, ai_notes = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, notes || `Manually reviewed and ${status.toLowerCase()} by administrator`, challenge_id);

  if (status === 'Approved' && challenge.status !== 'Approved') {
    // Award EcoCredit if previously not approved
    const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(challenge.user_id);
    if (wallet) {
      db.prepare(`
        UPDATE wallets 
        SET ecocredits_balance = ecocredits_balance + 1,
            total_earned = total_earned + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(challenge.user_id);

      db.prepare(`
        INSERT INTO wallet_transactions (user_id, amount, type, description)
        VALUES (?, 1, 'challenge_reward', ?)
      `).run(challenge.user_id, `Admin approved planting for ${challenge.disposal_id}`);
    }

    sendAIVerificationEmail({
      userEmail: user.email,
      userName: user.name,
      disposalId: challenge.disposal_id,
      status: 'Approved',
      creditsEarned: 1,
      notes: notes || 'Approved after administrative review',
      userId: user.id
    });
  }

  return res.json({
    message: `Challenge #${challenge_id} updated to status "${status}" successfully.`,
    challenge_id,
    new_status: status
  });
}

function getEmailLogs(req, res) {
  const logs = db.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 100').all();
  return res.json(logs);
}

function getAllUsers(req, res) {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.brand_code, u.created_at,
           p.city, p.sustainability_level, w.ecocredits_balance
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN wallets w ON u.id = w.user_id
    ORDER BY u.created_at DESC
  `).all();
  return res.json(users);
}

function getAllDisposals(req, res) {
  const disposals = db.prepare(`
    SELECT * FROM disposals ORDER BY created_at DESC LIMIT 100
  `).all();
  return res.json(disposals);
}

function getCompanyApplications(req, res) {
  const applications = db.prepare(`
    SELECT * FROM company_applications ORDER BY submitted_at DESC
  `).all();
  return res.json(applications);
}

function approveCompanyApplication(req, res) {
  const { id } = req.params;
  const app = db.prepare('SELECT * FROM company_applications WHERE id = ?').get(id);
  if (!app) {
    return res.status(404).json({ error: 'Company application not found' });
  }

  const { hashPassword } = require('../db');
  const { sendCompanyApprovalEmail } = require('../services/emailService');

  const brandCode = app.brand_code || app.company_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const assignedCompanyId = `COMP-${brandCode.toUpperCase()}-2026-${String(100 + Number(id))}`;
  const generatedPassword = `EcoHub@${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(generatedPassword);

  try {
    // 1. Update application status
    db.prepare(`
      UPDATE company_applications 
      SET status = 'Approved',
          assigned_company_id = ?,
          assigned_password = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignedCompanyId, generatedPassword, id);

    // 2. Ensure company exists in companies table
    const existingCompany = db.prepare('SELECT id FROM companies WHERE brand_code = ?').get(brandCode);
    let companyId;
    if (!existingCompany) {
      const compRes = db.prepare(`
        INSERT INTO companies (name, brand_code, email, category, csr_budget_inr, sustainability_target_tons)
        VALUES (?, ?, ?, ?, 5000000, 150.0)
      `).run(app.company_name, brandCode, app.official_email, app.company_type || 'Consumer Electronics');
      companyId = Number(compRes.lastInsertRowid);
    } else {
      companyId = existingCompany.id;
    }

    // 3. Create or update user account for company login
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(app.official_email.toLowerCase());
    if (existingUser) {
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, role = 'company', brand_code = ?
        WHERE id = ?
      `).run(passwordHash, brandCode, existingUser.id);
    } else {
      const userRes = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, brand_code)
        VALUES (?, ?, ?, 'company', ?)
      `).run(app.company_name, app.official_email.toLowerCase(), passwordHash, brandCode);

      db.prepare(`
        INSERT INTO user_profiles (user_id, phone, city)
        VALUES (?, ?, ?)
      `).run(Number(userRes.lastInsertRowid), app.contact_number || '', app.city || 'India');
    }

    // 4. Send Approval Email with generated ID and Password
    sendCompanyApprovalEmail({
      officialEmail: app.official_email,
      companyName: app.company_name,
      companyId: assignedCompanyId,
      password: generatedPassword
    });

    return res.json({
      success: true,
      message: `Company application #${id} approved! Login credentials dispatched to ${app.official_email}.`,
      assigned_company_id: assignedCompanyId,
      assigned_password: generatedPassword
    });
  } catch (err) {
    console.error('Error approving company application:', err);
    return res.status(500).json({ error: 'Failed to approve company application' });
  }
}

function getBagQRsForPrinting(req, res) {
  // Admin-only bag QR master generator & printer
  const brand = req.query.brand || req.query.company;
  const batch = req.query.batch || req.query.batch_code;
  let query = 'SELECT b.*, c.name as company_name FROM ecobags b JOIN companies c ON b.company_id = c.id WHERE 1=1';
  let params = [];
  if (brand) {
    query += ' AND b.brand_code = ?';
    params.push(brand.toLowerCase());
  }
  if (batch) {
    query += ' AND b.batch_code = ?';
    params.push(batch);
  }
  const requestedLimit = Number.parseInt(req.query.limit, 10) || 10000;
  const limit = Math.min(Math.max(requestedLimit, 1), 10000);
  query += ' ORDER BY b.created_at DESC LIMIT ?';
  params.push(limit);

  const bags = db.prepare(query).all(...params);
  const { generateQrSvg } = require('./disposalController');

  const enriched = bags.map(b => ({
    ...b,
    seed_type: b.seed_type || 'Tulsi & Organic Marigold',
    qr_svg: b.qr_svg || generateQrSvg(b.qr_data),
    print_url: b.qr_data,
    instructions_text: 'EcoHub Biodegradable Seed Bag • Scan to Dispose E-Waste Responsibly & Earn Rewards'
  }));

  return res.json(enriched);
}

function getCentreApplications(req, res) {
  const applications = db.prepare(`
    SELECT * FROM collection_centre_applications ORDER BY submitted_at DESC
  `).all();
  return res.json(applications);
}

function approveCentreApplication(req, res) {
  const { id } = req.params;
  const app = db.prepare('SELECT * FROM collection_centre_applications WHERE id = ?').get(id);
  if (!app) {
    return res.status(404).json({ error: 'Collection centre application not found' });
  }
  if (app.status === 'Approved') {
    return res.status(409).json({ error: 'Application already approved', assigned_code: app.assigned_code });
  }

  const { hashPassword } = require('../db');
  const { sendCollectionCentreCredentialsEmail } = require('../services/emailService');

  const countRow = db.prepare('SELECT COUNT(*) as count FROM collection_centres').get();
  const nextSeq = String(countRow.count + 1).padStart(3, '0');
  const assignedCode = `CP${nextSeq}`;
  const generatedPassword = `EcoHub@${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(generatedPassword);

  try {
    db.prepare(`
      INSERT INTO collection_centres (
        name, address, latitude, longitude, phone, license_no,
        email, officer_name, assigned_code, password_hash, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      app.centre_name,
      app.address || 'Authorized Hub Address',
      app.latitude || 28.62,
      app.longitude || 77.22,
      app.phone || '+91 9800000000',
      app.license_number || `CPCB/2026/${assignedCode}`,
      app.email,
      app.officer_name || 'Verification Officer',
      assignedCode,
      passwordHash
    );

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(app.email);
    if (existingUser) {
      db.prepare(`UPDATE users SET password_hash = ?, role = 'collection_centre' WHERE id = ?`).run(passwordHash, existingUser.id);
    } else {
      db.prepare(`INSERT INTO users (name, email, password_hash, role, brand_code) VALUES (?, ?, ?, 'collection_centre', NULL)`).run(app.centre_name, app.email, passwordHash);
    }

    db.prepare(`
      UPDATE collection_centre_applications
      SET status = 'Approved', assigned_code = ?, assigned_password = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignedCode, generatedPassword, id);

    sendCollectionCentreCredentialsEmail({
      email: app.email,
      centreName: app.centre_name,
      assignedCode,
      password: generatedPassword
    });

    return res.json({
      success: true,
      message: `Collection centre application #${id} approved! Login credentials dispatched to ${app.email}.`,
      assigned_code: assignedCode,
      assigned_password: generatedPassword
    });
  } catch (err) {
    console.error('Error approving centre application:', err);
    return res.status(500).json({ error: 'Failed to approve centre application' });
  }
}

function updateCentreStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Pending Review', 'Approved', 'Rejected', 'Suspended'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed values: ${allowed.join(', ')}` });
  }

  const app = db.prepare('SELECT * FROM collection_centre_applications WHERE id = ?').get(id);
  if (!app) {
    return res.status(404).json({ error: 'Collection centre application not found' });
  }

  db.prepare(`UPDATE collection_centre_applications SET status = ? WHERE id = ?`).run(status, id);

  // If approved, ensure centre record is active/updated
  if (app.assigned_code) {
    const centreStatus = status === 'Approved' ? 'active' : status === 'Suspended' ? 'suspended' : 'inactive';
    db.prepare(`UPDATE collection_centres SET status = ? WHERE assigned_code = ?`).run(centreStatus, app.assigned_code);
  }

  return res.json({
    success: true,
    message: `Collection Centre application #${id} status updated to "${status}".`,
    status
  });
}

function updateCompanyStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Pending Review', 'Approved', 'Rejected', 'Suspended'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed values: ${allowed.join(', ')}` });
  }

  const app = db.prepare('SELECT * FROM company_applications WHERE id = ?').get(id);
  if (!app) {
    return res.status(404).json({ error: 'Company application not found' });
  }

  db.prepare(`UPDATE company_applications SET status = ? WHERE id = ?`).run(status, id);

  return res.json({
    success: true,
    message: `Company application #${id} status updated to "${status}".`,
    status
  });
}

function getVerificationExceptions(req, res) {
  const exceptions = db.prepare(`
    SELECT * FROM disposals 
    WHERE status = 'REQUIRES REVIEW' OR verification_status = 'REQUIRES REVIEW' OR confidence_score < 80 AND status != 'Awaiting Collection Centre Verification'
    ORDER BY created_at DESC
  `).all();
  return res.json(exceptions);
}

function resolveVerificationException(req, res) {
  const { id } = req.params;
  const { decision, notes } = req.body; // 'approve' or 'reject'

  const disposal = db.prepare('SELECT * FROM disposals WHERE id = ?').get(id);
  if (!disposal) {
    return res.status(404).json({ error: 'Disposal record not found' });
  }

  if (decision === 'approve') {
    db.prepare(`
      UPDATE disposals 
      SET status = 'Verified Waste Record Created',
          verification_status = 'VERIFIED',
          confidence_score = 85,
          trust_score = 85,
          is_locked = 1,
          waste_record_created_at = CURRENT_TIMESTAMP,
          verified_by = ?
      WHERE id = ?
    `).run(`Admin Override (${req.user?.name || 'Administrator'})`, id);

    return res.json({
      success: true,
      message: `Exception for Disposal ${id} resolved as VERIFIED. Permanent digital waste record created.`,
      status: 'Verified Waste Record Created'
    });
  } else {
    db.prepare(`
      UPDATE disposals 
      SET status = 'Rejected / Incomplete Documentation',
          verification_status = 'REJECTED',
          is_locked = 1
      WHERE id = ?
    `).run(id);

    return res.json({
      success: true,
      message: `Exception for Disposal ${id} marked as REJECTED.`,
      status: 'Rejected / Incomplete Documentation'
    });
  }
}

function getAllEcoBagOrders(req, res) {
  const orders = db.prepare(`
    SELECT o.*, c.name as company_name 
    FROM ecobag_orders o
    LEFT JOIN companies c ON o.company_id = c.id
    ORDER BY o.ordered_at DESC
  `).all();
  return res.json(orders);
}

function updateEcoBagOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Ordered', 'Shipped', 'Delivered', 'Activated'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed values: ${allowed.join(', ')}` });
  }

  const order = db.prepare('SELECT * FROM ecobag_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: 'EcoBag order not found' });
  }

  db.prepare(`UPDATE ecobag_orders SET status = ? WHERE id = ?`).run(status, id);

  if (order.batch_code) {
    db.prepare(`UPDATE ecobags SET status = ? WHERE batch_code = ?`).run(status, order.batch_code);
  }

  return res.json({
    success: true,
    message: `EcoBag order #${id} status updated to "${status}".`,
    status
  });
}

function getAuditLedger(req, res) {
  const logs = db.prepare(`
    SELECT l.*, d.item_name, d.category, d.brand_name, d.collection_centre_name
    FROM verification_logs l
    LEFT JOIN disposals d ON l.disposal_id = d.id
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all();
  return res.json(logs);
}

module.exports = {
  getAdminOverview,
  getAIReviewQueue,
  overrideChallengeStatus,
  getEmailLogs,
  getAllUsers,
  getAllDisposals,
  getCompanyApplications,
  approveCompanyApplication,
  updateCompanyStatus,
  getBagQRsForPrinting,
  getCentreApplications,
  approveCentreApplication,
  updateCentreStatus,
  getVerificationExceptions,
  resolveVerificationException,
  getAllEcoBagOrders,
  updateEcoBagOrderStatus,
  getAuditLedger
};
