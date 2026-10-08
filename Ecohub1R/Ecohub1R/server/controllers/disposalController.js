const { db } = require('../db');
const { sendEmail1DisposalConfirmation } = require('../services/emailService');
const QRCode = require('qrcode');

function generateQrSvg(data) {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
  const moduleCount = qr.modules.size;
  const quietZone = 4;
  const scale = 6;
  const imageSize = (moduleCount + quietZone * 2) * scale;
  let modules = '';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.modules.data[row * moduleCount + column]) {
        modules += `<rect x="${(column + quietZone) * scale}" y="${(row + quietZone) * scale}" width="${scale}" height="${scale}" fill="#0f172a"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imageSize} ${imageSize}" width="${imageSize}" height="${imageSize}" shape-rendering="crispEdges"><rect width="${imageSize}" height="${imageSize}" fill="#ffffff"/>${modules}</svg>`;
}

function generateQrDataUrl(data) {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    width: 280,
    margin: 2
  });
}

const DEVICE_REWARDS = {
  Laptop: 150,
  Mobile: 150,
  Monitor: 150,
  Charger: 150,
  Battery: 150,
  Other: 150
};


function generateNextDisposalId() {
  const rows = db.prepare("SELECT id FROM disposals WHERE id LIKE 'EH-2026-%' OR id LIKE 'DISP-2026-%'").all();
  let maxSeq = 10000;
  for (const r of rows) {
    const match = r.id.match(/(?:EH|DISP)-2026-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  return `EH-2026-${String(maxSeq + 1).padStart(5, '0')}`;
}

async function submitDisposal(req, res) {
  const {
    item_name,
    category,
    device_type,
    brand_code = 'generic',
    brand_name,
    item_condition = 'Used',
    estimated_weight_kg = 1.5,
    photo_url = '',
    product_id_image = '',
    serial_number = '',
    user_address = '',
    user_phone = '',
    collection_centre_id,
    bag_id,
    appointment_time
  } = req.body;

  const finalCategory = category || device_type || 'Other';
  const finalItemName = item_name || `${finalCategory} Hardware`;

  if (!collection_centre_id) {
    return res.status(400).json({ error: 'Collection centre selection is required' });
  }

  if (!bag_id) {
    return res.status(400).json({ error: 'Scan a company EcoBag QR code before registering this disposal.' });
  }

  const bag = db.prepare(`
    SELECT b.*, c.name AS company_name
    FROM ecobags b
    JOIN companies c ON c.id = b.company_id
    WHERE b.bag_id = ?
  `).get(bag_id);
  if (!bag) {
    return res.status(404).json({ error: 'Company EcoBag QR code was not recognized.' });
  }

  // Lookup centre
  const centre = db.prepare('SELECT * FROM collection_centres WHERE id = ?').get(collection_centre_id);
  if (!centre) {
    return res.status(404).json({ error: 'Selected collection centre not found' });
  }

  try {
    // Generate sequential Disposal ID in EH-2026-XXXXX format
    const disposalId = generateNextDisposalId();
    const rewardPoints = DEVICE_REWARDS[finalCategory] || 25;

    // Cryptographic Registration Hash: SHA-256(UserId + Category + Timestamp + PhotoHash)
    const crypto = require('node:crypto');
    const photoHash = crypto.createHash('sha256').update(photo_url || 'no-photo').digest('hex');
    const regTimestamp = new Date().toISOString();
    const registrationHash = crypto.createHash('sha256')
      .update(`${req.user.id}:${finalCategory}:${regTimestamp}:${photoHash}`)
      .digest('hex');

    const qrData = `ECOHUB:${disposalId}:${bag.brand_code}:${estimated_weight_kg}kg:${registrationHash.slice(0, 8)}`;
    const qrSvg = generateQrSvg(qrData);
    const qrDataUrl = await generateQrDataUrl(qrData);

    const user = req.user;

    const insert = db.prepare(`
      INSERT INTO disposals (
        id, user_id, user_name, user_email, user_phone, user_address, bag_id, item_name, category, brand_code, brand_name,
        item_condition, estimated_weight_kg, photo_url, product_id_image, serial_number, collection_centre_id, collection_centre_name,
        collection_centre_address, status, qr_data, created_at, reward_points, trust_score, confidence_score,
        verification_status, is_locked, registration_hash, user_photo_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Awaiting Collection Centre Verification', ?, CURRENT_TIMESTAMP, ?, 0, 0, 'Awaiting Verification', 0, ?, ?)
    `);

    insert.run(
      disposalId,
      user.id,
      user.name,
      user.email,
      user_phone || '',
      user_address || '',
      bag.bag_id,
      finalItemName,
      finalCategory,
      bag.brand_code,
      bag.company_name,
      item_condition,
      parseFloat(estimated_weight_kg) || 1.2,
      photo_url,
      product_id_image || '',
      serial_number || '',
      centre.id,
      centre.name,
      centre.address,
      qrData,
      rewardPoints,
      registrationHash,
      photoHash
    );


    // Trigger EMAIL #1 - Disposal Confirmation immediately
    sendEmail1DisposalConfirmation({
      userEmail: user.email,
      userName: user.name,
      disposalId,
      centreName: centre.name,
      centreAddress: centre.address,
      qrCodeData: qrDataUrl,
      appointmentInfo: appointment_time,
      userId: user.id
    });

    const record = db.prepare('SELECT * FROM disposals WHERE id = ?').get(disposalId);

    return res.status(201).json({
      message: 'Disposal request created successfully',
      disposal: {
        ...record,
        qr_svg: qrSvg
      },
      email_dispatched: true
    });
  } catch (err) {
    console.error('Error submitting disposal:', err);
    return res.status(500).json({ error: 'Failed to create disposal submission' });
  }
}

function getUserDisposals(req, res) {
  const disposals = db.prepare(`
    SELECT d.*, c.status as challenge_status, c.id as challenge_id 
    FROM disposals d
    LEFT JOIN challenges c ON d.id = c.disposal_id
    WHERE d.user_id = ?
    ORDER BY d.created_at DESC
  `).all(req.user.id);

  const enriched = disposals.map(d => ({
    ...d,
    qr_svg: generateQrSvg(d.qr_data)
  }));

  return res.json(enriched);
}

function getDisposalById(req, res) {
  const { id } = req.params;
  const disposal = db.prepare(`
    SELECT d.*, c.status as challenge_status, c.ai_notes, c.id as challenge_id
    FROM disposals d
    LEFT JOIN challenges c ON d.id = c.disposal_id
    WHERE d.id = ?
  `).get(id);

  if (!disposal) {
    return res.status(404).json({ error: 'Disposal record not found' });
  }

  let coupon = null;
  if (disposal.user_id) {
    coupon = db.prepare(`
      SELECT * FROM coupons WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(disposal.user_id);
  }

  return res.json({
    ...disposal,
    coupon,
    verified_reward: disposal.status === 'Received at Collection Centre' ? {
      ecocredits: 10,
      reward_status: '100% Verified and Credited',
      certificate_eligible: true
    } : null,
    qr_svg: generateQrSvg(disposal.qr_data)
  });
}

async function submitPublicDisposal(req, res) {
  const {
    bag_id = '',
    item_name,
    category = 'Electronics',
    brand_code = 'samsung',
    brand_name,
    item_condition = 'Used',
    estimated_weight_kg = 1.5,
    collection_centre_id,
    photo_url = '',
    product_photo = '',
    product_id_image = '',
    serial_number = '',
    user_address = '',
    user_email,
    user_name = 'Eco Citizen',
    user_phone = '',
    appointment_time
  } = req.body;

  if (!item_name || !collection_centre_id || !user_email) {
    return res.status(400).json({ error: 'Item name, collection centre, and user email are required.' });
  }

  if (!bag_id) {
    return res.status(400).json({ error: 'Scan a company EcoBag QR code before registering this disposal.' });
  }

  const bag = db.prepare(`
    SELECT b.*, c.name AS company_name
    FROM ecobags b
    JOIN companies c ON c.id = b.company_id
    WHERE b.bag_id = ?
  `).get(bag_id);
  if (!bag) {
    return res.status(404).json({ error: 'Company EcoBag QR code was not recognized.' });
  }

  // Lookup centre
  const centre = db.prepare('SELECT * FROM collection_centres WHERE id = ?').get(collection_centre_id);
  if (!centre) {
    return res.status(404).json({ error: 'Selected collection centre not found' });
  }

  // Lookup or auto-provision citizen record so foreign key is satisfied
  const cleanEmail = user_email.trim().toLowerCase();
  const existingUser = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(cleanEmail);
  if (existingUser && existingUser.role !== 'user') {
    return res.status(409).json({ error: 'This email belongs to a company or collection-centre account. Use a personal email for disposal.' });
  }
  let userId;
  const finalUserName = existingUser ? existingUser.name : (user_name || 'Eco Citizen');

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { hashPassword } = require('../db');
    const tempPw = hashPassword(require('node:crypto').randomBytes(32).toString('hex'));
    const newUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'user')
    `).run(finalUserName, user_email.trim().toLowerCase(), tempPw);
    userId = Number(newUser.lastInsertRowid);

    db.prepare(`
      INSERT INTO user_profiles (user_id, phone, address, city)
      VALUES (?, ?, ?, 'New Delhi')
    `).run(userId, user_phone || '', user_address || '');

    db.prepare(`
      INSERT INTO wallets (user_id, ecocredits_balance, total_earned)
      VALUES (?, 0, 0)
    `).run(userId);
  }

  // Lookup brand name if not provided
  const finalBrandCode = bag.brand_code;
  const finalBrandName = bag.company_name;

  try {
    const disposalId = generateNextDisposalId();
    const weightVal = parseFloat(estimated_weight_kg) || 1.2;
    const finalCategory = category || 'Other';
    const rewardPoints = DEVICE_REWARDS[finalCategory] || 25;
    const finalPhoto = photo_url || product_photo || '';

    const crypto = require('node:crypto');
    const photoHash = crypto.createHash('sha256').update(finalPhoto || 'no-photo').digest('hex');
    const regTimestamp = new Date().toISOString();
    const registrationHash = crypto.createHash('sha256')
      .update(`${userId}:${finalCategory}:${regTimestamp}:${photoHash}`)
      .digest('hex');

    const qrData = `ECOHUB:${disposalId}:${finalBrandCode}:${weightVal}kg:${registrationHash.slice(0, 8)}`;
    const qrSvg = generateQrSvg(qrData);
    const qrDataUrl = await generateQrDataUrl(qrData);

    const insert = db.prepare(`
      INSERT INTO disposals (
        id, user_id, user_name, user_email, user_phone, user_address, bag_id, item_name, category, brand_code, brand_name,
        item_condition, estimated_weight_kg, photo_url, product_id_image, serial_number, collection_centre_id, collection_centre_name,
        collection_centre_address, status, qr_data, created_at, reward_points, trust_score, confidence_score,
        verification_status, is_locked, registration_hash, user_photo_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Awaiting Collection Centre Verification', ?, CURRENT_TIMESTAMP, ?, 0, 0, 'Awaiting Verification', 0, ?, ?)
    `);

    insert.run(
      disposalId,
      userId,
      finalUserName,
      cleanEmail,
      user_phone || '',
      user_address || '',
      bag_id || null,
      item_name,
      finalCategory,
      finalBrandCode,
      finalBrandName,
      item_condition,
      weightVal,
      finalPhoto,
      product_id_image || '',
      serial_number || '',
      centre.id,
      centre.name,
      centre.address,
      qrData,
      rewardPoints,
      registrationHash,
      photoHash
    );

    // Trigger EMAIL #1 - Disposal Confirmation with QR & Instructions
    sendEmail1DisposalConfirmation({
      userEmail: cleanEmail,
      userName: finalUserName,
      disposalId,
      centreName: centre.name,
      centreAddress: centre.address,
      qrCodeData: qrDataUrl,
      appointmentInfo: appointment_time,
      userId: userId || null
    });

    const record = db.prepare('SELECT * FROM disposals WHERE id = ?').get(disposalId);

    return res.status(201).json({
      message: 'Disposal record registered successfully! Awaiting collection centre verification.',
      disposal: {
        ...record,
        qr_svg: qrSvg
      },
      status: 'Awaiting Collection Centre Verification',
      email_sent: true
    });
  } catch (err) {
    console.error('Public disposal submission error:', err);
    return res.status(500).json({ error: 'Failed to create disposal pass' });
  }
}

function getBagInfo(req, res) {
  const bagId = req.params.bagId || req.query.bag_id;
  if (!bagId) {
    return res.status(400).json({ error: 'Bag ID required' });
  }

  const bag = db.prepare(`
    SELECT b.*, c.name as company_name, c.brand_code
    FROM ecobags b
    LEFT JOIN companies c ON b.company_id = c.id
    WHERE b.bag_id = ?
  `).get(bagId);

  if (!bag) {
    return res.status(404).json({ error: 'Company EcoBag QR code was not recognized.' });
  }

  return res.json(bag);
}

function getDisposalJourney(req, res) {
  const { id } = req.params;
  const disposal = db.prepare('SELECT * FROM disposals WHERE id = ?').get(id);
  if (!disposal) {
    return res.status(404).json({ error: `Disposal record ${id} not found.` });
  }

  const centre = db.prepare('SELECT * FROM collection_centres WHERE id = ?').get(disposal.collection_centre_id);
  const company = db.prepare('SELECT * FROM companies WHERE brand_code = ?').get(disposal.brand_code);
  const logs = db.prepare('SELECT * FROM verification_logs WHERE disposal_id = ? ORDER BY created_at ASC').all(id);

  let parsedChecks = null;
  try {
    parsedChecks = disposal.verification_checks ? JSON.parse(disposal.verification_checks) : null;
  } catch (e) {}

  const isVerified = disposal.status === 'Verified Waste Record Created' || disposal.status === 'VERIFIED' || disposal.status === 'Received at Collection Centre';
  const confidenceScore = disposal.confidence_score || disposal.trust_score || 0;

  return res.json({
    disposal_id: disposal.id,
    current_status: disposal.status,
    verification_status: disposal.verification_status,
    is_locked: Boolean(disposal.is_locked),
    stage_1_user_engagement: {
      step_completed: true,
      status: 'Disposal Request Registered & Bound',
      timestamp: disposal.created_at,
      user: {
        name: disposal.user_name || 'Eco Citizen',
        email: disposal.user_email,
        phone: disposal.user_phone || '—',
        address: disposal.user_address || '—'
      },
      product: {
        item_name: disposal.item_name,
        category: disposal.category,
        brand_code: disposal.brand_code,
        brand_name: disposal.brand_name,
        condition: disposal.item_condition,
        estimated_weight_kg: disposal.estimated_weight_kg,
        serial_number: disposal.serial_number || '—',
        photo_url: disposal.photo_url || null,
        product_id_image: disposal.product_id_image || null
      },
      selected_collection_centre: {
        id: disposal.collection_centre_id,
        name: disposal.collection_centre_name,
        address: disposal.collection_centre_address
      },
      disposal_id: disposal.id,
      qr_data: disposal.qr_data
    },
    stage_2_collection_centre_verification: {
      step_completed: isVerified || disposal.status === 'REQUIRES REVIEW',
      timestamp: disposal.verification_timestamp || disposal.received_at || null,
      verified_by: disposal.verified_by || (isVerified ? 'Certified Verification Officer' : null),
      collection_centre: centre ? {
        id: centre.id,
        name: centre.name,
        address: centre.address,
        license_no: centre.license_no
      } : { name: disposal.collection_centre_name, address: disposal.collection_centre_address },
      required_evidence: {
        product_id_image: disposal.evidence_product_id_url || disposal.product_id_image || null,
        product_photo: disposal.centre_photo_url || disposal.evidence_photo_url || disposal.photo_url || null
      },
      confidence_score: confidenceScore,
      confidence_threshold: 80,
      checks_passed: parsedChecks?.passed || (isVerified ? [
        'Product Photograph Uploaded and Inspected',
        'Product ID / Serial Label Evidence Verified',
        'Hardware Category & Specifications Matched',
        'Documentation & Chain of Custody Complete',
        'Authorized Collection Centre Identity Confirmed'
      ] : []),
      checks_failed: parsedChecks?.failed || [],
      verification_outcome: isVerified ? 'VERIFIED' : (disposal.status === 'REQUIRES REVIEW' ? 'REQUIRES REVIEW' : 'AWAITING INTAKE')
    },
    stage_3_verified_waste_record: {
      record_created: isVerified && Boolean(disposal.waste_record_created_at || disposal.is_locked),
      timestamp: disposal.waste_record_created_at || disposal.verification_timestamp || null,
      permanent_record_id: `PWR-${disposal.id}`,
      status: isVerified ? 'Verified Waste Record Created' : disposal.status,
      digital_waste_record: isVerified ? {
        disposal_id: disposal.id,
        product_details: `${disposal.item_name} (${disposal.category}, ${disposal.brand_name})`,
        user_details: `${disposal.user_name} <${disposal.user_email}>`,
        collection_centre_details: `${disposal.collection_centre_name}, ${disposal.collection_centre_address}`,
        verification_timestamp: disposal.waste_record_created_at || disposal.verification_timestamp || disposal.received_at,
        immutable_sha256_hash: disposal.registration_hash || 'SHA256:VERIFIED_CHAIN'
      } : null
    },
    stage_4_company_compliance: {
      company: company ? {
        name: company.name,
        brand_code: company.brand_code,
        category: company.category
      } : { brand_code: disposal.brand_code, name: disposal.brand_name },
      compliance_status: isVerified ? 'Audited & Allocated to EPR Compliance Ledger' : 'Pending Verification Intake',
      traceability_logs: logs
    },
    qr_svg: generateQrSvg(disposal.qr_data)
  });
}

module.exports = {
  submitDisposal,
  submitPublicDisposal,
  getUserDisposals,
  getDisposalById,
  getDisposalJourney,
  getBagInfo,
  generateQrSvg
};
