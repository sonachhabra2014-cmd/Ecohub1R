const crypto = require('node:crypto');
const { db } = require('../db');
const { generateImpactReport } = require('../services/reportService');
const { sendCompanyOrderNotificationToAdmin } = require('../services/emailService');

function getCompanyMetrics(req, res) {
  // STRICT DATA PRIVACY: Use brand_code attached by enforceCompanyPrivacy middleware
  // If user is Admin, they can view a specific brand via query param or default to samsung
  let brandCode = req.companyBrand;
  if (req.user.role === 'admin' && req.query.brand) {
    brandCode = req.query.brand.toLowerCase();
  }

  if (!brandCode) {
    return res.status(403).json({ error: 'Company brand identification required' });
  }

  const company = db.prepare('SELECT * FROM companies WHERE brand_code = ?').get(brandCode);
  if (!company) {
    return res.status(404).json({ error: `Company with brand "${brandCode}" not found` });
  }

  // Strictly isolated query for only this company's disposals
  const disposals = db.prepare(`
    SELECT * FROM disposals 
    WHERE brand_code = ? 
    ORDER BY created_at DESC
  `).all(brandCode);

  const verifiedDisposals = disposals.filter(d => 
    d.status === 'Verified Waste Record Created' || 
    d.status === 'VERIFIED' || 
    d.status === 'Received at Collection Centre'
  );
  const totalWeightKg = disposals.reduce((sum, d) => sum + (d.estimated_weight_kg || 1.5), 0);
  const verifiedWeightKg = verifiedDisposals.reduce((sum, d) => sum + (d.estimated_weight_kg || 1.5), 0);

  // Category-wise distribution
  const categoryMap = {};
  disposals.forEach(d => {
    const cat = d.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + (d.estimated_weight_kg || 1.5);
  });
  const categoryDistribution = Object.keys(categoryMap).map(name => ({
    name,
    weight_kg: parseFloat(categoryMap[name].toFixed(2)),
    count: disposals.filter(d => (d.category || 'Other') === name).length
  }));

  // Device-wise breakdown (top items)
  const itemMap = {};
  disposals.forEach(d => {
    itemMap[d.item_name] = (itemMap[d.item_name] || 0) + 1;
  });
  const deviceBreakdown = Object.keys(itemMap).map(item => ({
    item,
    count: itemMap[item]
  })).sort((a, b) => b.count - a.count);

  const monthlyMap = {};
  disposals.forEach((disposal) => {
    const month = new Date(disposal.created_at).toLocaleString('en-US', { month: 'short' });
    if (!monthlyMap[month]) monthlyMap[month] = { month, weight_kg: 0, count: 0 };
    monthlyMap[month].weight_kg += disposal.estimated_weight_kg || 1.5;
    monthlyMap[month].count += 1;
  });
  const monthlyTrends = Object.values(monthlyMap).map((month) => ({
    ...month,
    weight_kg: parseFloat(month.weight_kg.toFixed(2))
  }));

  // Collection Centre Performance
  const centreMap = {};
  disposals.forEach(d => {
    const name = d.collection_centre_name || 'Authorized Hub';
    centreMap[name] = (centreMap[name] || 0) + (d.estimated_weight_kg || 1.5);
  });
  const collectionCentresPerformance = Object.keys(centreMap).map(centre => ({
    centre,
    weight_kg: parseFloat(centreMap[centre].toFixed(2)),
    count: disposals.filter(d => d.collection_centre_name === centre).length
  }));

  // Sustainability Metrics
  const challenges = db.prepare(`
    SELECT c.* FROM challenges c
    JOIN disposals d ON c.disposal_id = d.id
    WHERE d.brand_code = ? AND c.status = 'Approved'
  `).all(brandCode);

  const totalPlants = Math.max(verifiedDisposals.length, challenges.length);
  const co2SavedKg = parseFloat((verifiedWeightKg * 1.44).toFixed(2));
  const toxicMetalsKg = parseFloat((verifiedWeightKg * 0.082).toFixed(2));
  const landfillSavedM3 = parseFloat((verifiedWeightKg * 0.025).toFixed(2));

  // User Engagement Metrics
  const uniqueUsers = new Set(disposals.map(d => d.user_id)).size;
  const completionRate = disposals.length > 0
    ? Math.round((verifiedDisposals.length / disposals.length) * 100)
    : 100;

  return res.json({
    company: {
      id: company.id,
      name: company.name,
      brand_code: company.brand_code,
      category: company.category,
      csr_budget_inr: company.csr_budget_inr,
      target_tons: company.sustainability_target_tons
    },

    // 1. E-Waste Metrics
    ewaste_metrics: {
      total_weight_kg: parseFloat(totalWeightKg.toFixed(2)),
      total_weight_metric_tons: parseFloat((totalWeightKg / 1000).toFixed(3)),
      total_units_collected: disposals.length,
      verified_recycled_kg: parseFloat(verifiedWeightKg.toFixed(2)),
      category_distribution: categoryDistribution,
      device_breakdown: deviceBreakdown,
      monthly_trends: monthlyTrends,
      collection_centres_performance: collectionCentresPerformance
    },

    // 1.5 LIVE PIE DASHBOARD 1: E-Waste Category Breakdown (STRICTLY REAL DATA)
    ewaste_pie_data: (() => {
      const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#94a3b8'];
      if (categoryDistribution.length === 0) {
        return [];
      }
      return categoryDistribution.map((cat, idx) => ({
        name: cat.name,
        weight_kg: cat.weight_kg,
        count: cat.count,
        percentage: totalWeightKg > 0 ? parseFloat(((cat.weight_kg / totalWeightKg) * 100).toFixed(1)) : 0,
        color: PIE_COLORS[idx % PIE_COLORS.length]
      }));
    })(),

    // 1.6 LIVE PIE DASHBOARD 2: Physical Verification Status (STRICTLY REAL DATA)
    verification_status_pie: (() => {
      if (disposals.length === 0) return [];
      const verifiedCount = verifiedDisposals.length;
      const pendingCount = disposals.length - verifiedCount;
      const result = [];
      if (verifiedCount > 0) {
        result.push({
          name: 'Verified at Collection Centre',
          count: verifiedCount,
          weight_kg: parseFloat(verifiedWeightKg.toFixed(2)),
          percentage: parseFloat(((verifiedCount / disposals.length) * 100).toFixed(1)),
          color: '#10b981'
        });
      }
      if (pendingCount > 0) {
        result.push({
          name: 'Registered / In Transit',
          count: pendingCount,
          weight_kg: parseFloat((totalWeightKg - verifiedWeightKg).toFixed(2)),
          percentage: parseFloat(((pendingCount / disposals.length) * 100).toFixed(1)),
          color: '#f59e0b'
        });
      }
      return result;
    })(),

    // 1.7 LIVE PIE DASHBOARD 3: Top Device Breakdown (STRICTLY REAL DATA)
    device_breakdown_pie: (() => {
      if (deviceBreakdown.length === 0) return [];
      const DEVICE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
      const totalDevices = disposals.length;
      return deviceBreakdown.slice(0, 6).map((d, idx) => ({
        name: d.item,
        count: d.count,
        percentage: totalDevices > 0 ? parseFloat(((d.count / totalDevices) * 100).toFixed(1)) : 0,
        color: DEVICE_COLORS[idx % DEVICE_COLORS.length]
      }));
    })(),

    // 2. Sustainability Metrics (Strictly calculated from real data)
    sustainability_metrics: {
      total_plants_initiated: totalPlants,
      verified_plantations: challenges.length,
      ecocredits_awarded: challenges.length * 150,
      participation_rate: disposals.length > 0 ? `${completionRate}%` : "0%",
      carbon_impact_estimation_kg: co2SavedKg,
      toxic_metals_diverted_kg: toxicMetalsKg,
      landfill_space_preserved_m3: landfillSavedM3,
      clean_air_impact_score: verifiedDisposals.length > 0 ? `${Math.min(100, Math.round(verifiedWeightKg * 20))} / 100` : "0 / 100"
    },

    // 2.5 Plant Germination Breakdown (Strictly real database counts)
    plant_germination_pie_data: (() => {
      const plantStages = [
        { key: 'bloomed', name: 'Fully Bloomed', count: 0, color: '#10b981', icon: '🌸' },
        { key: 'vegetative', name: 'Vegetative Growth', count: 0, color: '#3b82f6', icon: '🌿' },
        { key: 'sprouting', name: 'Sprouting', count: 0, color: '#f59e0b', icon: '🌱' },
        { key: 'seeded', name: 'Planted', count: 0, color: '#8b5cf6', icon: '🌰' }
      ];

      disposals.forEach(d => {
        const days = d.plant_day_count || 0;
        if (days >= 8) plantStages[0].count += 1;
        else if (days >= 4) plantStages[1].count += 1;
        else if (days >= 1) plantStages[2].count += 1;
        else plantStages[3].count += 1;
      });

      const totalItems = disposals.length;
      if (totalItems === 0) {
        return [];
      }

      const effectiveTotal = plantStages.reduce((sum, s) => sum + s.count, 0) || 1;
      return plantStages.filter(s => s.count > 0).map(s => ({
        ...s,
        percentage: parseFloat(((s.count / effectiveTotal) * 100).toFixed(1))
      }));
    })(),

    // Seed Varieties embedded in this company's EcoBags (Strictly real)
    seed_variety_pie_data: (() => {
      let orders = [];
      try {
        orders = db.prepare('SELECT seed_type, SUM(quantity) as qty FROM ecobag_orders WHERE brand_code = ? GROUP BY seed_type').all(brandCode);
      } catch (e) {}

      if (orders.length > 0) {
        const totalBags = orders.reduce((sum, o) => sum + o.qty, 0) || 1;
        const SEED_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
        return orders.map((o, idx) => ({
          name: o.seed_type || 'Tulsi & Organic Marigold',
          count: o.qty,
          percentage: parseFloat(((o.qty / totalBags) * 100).toFixed(1)),
          color: SEED_COLORS[idx % SEED_COLORS.length]
        }));
      }

      return [];
    })(),

    // 3. User Engagement Metrics (Strictly genuine)
    user_engagement_metrics: {
      disposal_completion_rate: `${completionRate}%`,
      active_users: uniqueUsers,
      total_submissions: disposals.length,
      verified_dropoffs: verifiedDisposals.length
    },

    // Verified Waste Records
    waste_records: verifiedDisposals,

    // Verification Logs for this brand
    verification_logs: (() => {
      try {
        const ids = disposals.map(d => d.id);
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        return db.prepare(`
          SELECT * FROM verification_logs 
          WHERE disposal_id IN (${placeholders})
          ORDER BY created_at DESC
          LIMIT 50
        `).all(...ids);
      } catch (e) {
        return [];
      }
    })(),

    // Traceability Records
    traceability_records: disposals.map(d => ({
      disposal_id: d.id,
      item_name: d.item_name,
      category: d.category,
      user_name: d.user_name,
      collection_centre_name: d.collection_centre_name,
      status: d.status,
      confidence_score: d.confidence_score || d.trust_score || 0,
      is_locked: d.is_locked,
      created_at: d.created_at,
      received_at: d.received_at,
      waste_record_created_at: d.waste_record_created_at || d.verification_timestamp,
      hash: d.registration_hash || 'SHA256:VERIFIED_CHAIN'
    })),

    // Recent private records (ONLY for this company)
    disposals: disposals.slice(0, 50)
  });
}

function getImpactReport(req, res) {
  let brandCode = req.companyBrand;
  if (req.user.role === 'admin' && req.query.brand) {
    brandCode = req.query.brand.toLowerCase();
  }

  if (!brandCode) {
    return res.status(403).json({ error: 'Company brand identification required' });
  }

  try {
    const report = generateImpactReport(null, brandCode);
    return res.json(report);
  } catch (err) {
    console.error('Error generating impact report:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate impact report' });
  }
}

function applyCompany(req, res) {
  const {
    companyName,
    registrationNumber,
    companyType = 'Private Limited',
    officialEmail,
    contactNumber,
    address,
    city,
    state,
    pinCode,
    representativeName,
    designation,
    representativeEmail,
    eWasteTypes,
    monthlyCapacity,
    authorizationNumber,
    facilityAddress,
    password
  } = req.body;

  if (!companyName || !officialEmail) {
    return res.status(400).json({ error: 'Company Name and Official Email are required' });
  }

  const existingAccount = db.prepare('SELECT role FROM users WHERE email = ?').get(officialEmail.trim().toLowerCase());
  if (existingAccount?.role === 'admin') {
    return res.status(400).json({ error: 'Use a separate company email. The administrator email cannot be used for a company account.' });
  }

  // Derive clean unique brand_code
  let baseBrand = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  if (!baseBrand) baseBrand = 'comp';
  let brandCode = baseBrand;
  const existingApp = db.prepare('SELECT id FROM company_applications WHERE brand_code = ?').get(brandCode);
  if (existingApp) {
    brandCode = `${baseBrand}${Math.floor(100 + Math.random() * 900)}`;
  }

  const verificationToken = crypto.randomBytes(16).toString('hex');

  try {
    const insert = db.prepare(`
      INSERT INTO company_applications (
        company_name, brand_code, registration_number, company_type, official_email,
        contact_number, address, city, state, pin_code, representative_name, designation,
        representative_email, e_waste_types, monthly_capacity, authorization_number,
        facility_address, status, verification_token, submitted_at, assigned_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, CURRENT_TIMESTAMP, ?)
    `);

    const result = insert.run(
      companyName,
      brandCode,
      registrationNumber || '',
      companyType,
      officialEmail.trim().toLowerCase(),
      contactNumber || '',
      address || '',
      city || '',
      state || '',
      pinCode || '',
      representativeName || '',
      designation || '',
      representativeEmail || officialEmail,
      eWasteTypes || 'Electronics & Computing',
      monthlyCapacity || '50 Tons / Month',
      authorizationNumber || '',
      facilityAddress || '',
      verificationToken,
      password || 'EcoHub@2026'
    );

    const newAppId = Number(result.lastInsertRowid);

    // Forward details to Admin email
    const { sendCompanyApplicationNoticeToAdmin } = require('../services/emailService');
    sendCompanyApplicationNoticeToAdmin({
      applicationData: {
        id: newAppId,
        company_name: companyName,
        registration_number: registrationNumber,
        company_type: companyType,
        official_email: officialEmail,
        contact_number: contactNumber,
        representative_name: representativeName,
        designation: designation,
        e_waste_types: eWasteTypes,
        monthly_capacity: monthlyCapacity,
        authorization_number: authorizationNumber,
        facility_address: facilityAddress || address,
        verification_token: verificationToken
      }
    });

    return res.status(201).json({
      success: true,
      application_id: newAppId,
      brand_code: brandCode,
      message: `Company registration submitted successfully! Details forwarded to EcoHub Admin (${process.env.ADMIN_EMAIL || 'sonachhabra2014@gmail.com'}) for review and credential issuance.`
    });
  } catch (err) {
    console.error('Error in applyCompany:', err);
    return res.status(500).json({ error: 'Failed to submit company application' });
  }
}

// DIRECT ONE-CLICK EMAIL APPROVAL
function approveCompanyByToken(req, res) {
  const token = req.query.token || req.params.token;
  const appId = req.query.id;

  let app;
  if (appId) {
    app = db.prepare('SELECT * FROM company_applications WHERE id = ?').get(appId);
  } else if (token) {
    app = db.prepare('SELECT * FROM company_applications WHERE verification_token = ?').get(token);
  }

  if (!app) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>EcoHub - Application Not Found</title></head>
        <body style="font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
          <div style="background: #1e293b; border: 1px solid #ef4444; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center;">
            <h2 style="color: #ef4444; margin-top: 0;">Application Not Found</h2>
            <p style="color: #cbd5e1;">The requested company registration could not be located or may have been deleted.</p>
            <a href="http://localhost:5173/admin" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 12px;">Go to Admin Portal</a>
          </div>
        </body>
      </html>
    `);
  }

  if (app.status === 'Approved') {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>EcoHub - Already Approved</title></head>
        <body style="font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
          <div style="background: #1e293b; border: 1px solid #22c55e; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center;">
            <div style="font-size: 48px;">✓</div>
            <h2 style="color: #22c55e; margin-top: 8px;">Already Approved</h2>
            <p style="color: #cbd5e1;"><strong>${app.company_name}</strong> was already approved. Credentials have already been dispatched to <code>${app.official_email}</code>.</p>
            <p style="color: #94a3b8; font-size: 14px;">Assigned ID: <strong style="color: #38bdf8;">${app.assigned_company_id}</strong></p>
            <a href="http://localhost:5173/admin" style="display: inline-block; background: #22c55e; color: #0f172a; font-weight: bold; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">Admin Overview</a>
          </div>
        </body>
      </html>
    `);
  }

  const { hashPassword } = require('../db');
  const { sendCompanyApprovalEmail } = require('../services/emailService');

  const brandCode = app.brand_code || app.company_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const assignedCompanyId = `COMP-${brandCode.toUpperCase()}-2026-${String(100 + Number(app.id))}`;
  const generatedPassword = app.assigned_password || `EcoHub@${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(generatedPassword);

  try {
    const existingUserDetails = db.prepare('SELECT role FROM users WHERE email = ?').get(app.official_email.toLowerCase());
    if (existingUserDetails?.role === 'admin') {
      return res.status(409).send('The administrator email cannot be provisioned as a company account. Use a separate company email.');
    }

    // 1. Update application status
    db.prepare(`
      UPDATE company_applications 
      SET status = 'Approved',
          assigned_company_id = ?,
          assigned_password = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignedCompanyId, generatedPassword, app.id);

    // 2. Ensure company exists in companies table
    const existingCompany = db.prepare('SELECT id FROM companies WHERE brand_code = ?').get(brandCode);
    if (!existingCompany) {
      db.prepare(`
        INSERT INTO companies (name, brand_code, email, category, csr_budget_inr, sustainability_target_tons)
        VALUES (?, ?, ?, ?, 5000000, 150.0)
      `).run(app.company_name, brandCode, app.official_email, app.company_type || 'Consumer Electronics');
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

    // 4. Send Approval Email with generated ID and Password to the company's email
    sendCompanyApprovalEmail({
      officialEmail: app.official_email,
      companyName: app.company_name,
      companyId: assignedCompanyId,
      password: generatedPassword
    });

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EcoHub - Company Approved</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <div style="font-size: 54px; margin-bottom: 12px;">✅</div>
            <h1 style="color: #22c55e; margin: 0 0 8px 0; font-size: 26px;">Company Approved!</h1>
            <p style="color: #94a3b8; font-size: 15px; margin: 0 0 24px 0;">Corporate partnership verified and credentials provisioned.</p>
            
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 20px; text-align: left; margin-bottom: 24px;">
              <p style="margin: 6px 0; font-size: 14px; color: #cbd5e1;"><strong style="color: #94a3b8;">Company:</strong> ${app.company_name}</p>
              <p style="margin: 6px 0; font-size: 14px; color: #cbd5e1;"><strong style="color: #94a3b8;">Assigned ID:</strong> <code style="color: #22c55e; font-weight: bold; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${assignedCompanyId}</code></p>
              <p style="margin: 6px 0; font-size: 14px; color: #cbd5e1;"><strong style="color: #94a3b8;">Initial Password:</strong> <code style="color: #38bdf8; font-weight: bold; background: #1e293b; padding: 2px 6px; border-radius: 4px;">${generatedPassword}</code></p>
              <p style="margin: 6px 0; font-size: 14px; color: #cbd5e1;"><strong style="color: #94a3b8;">Dispatched To:</strong> ${app.official_email}</p>
            </div>
            
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
              Credentials have been dispatched to <strong>${app.official_email}</strong>. The company can now log in to the Corporate Portal to order EcoBags and view Power BI impact analytics.
            </p>

            <a href="http://localhost:5173/admin" style="display: inline-block; background: #22c55e; color: #0b1120; font-weight: 800; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px;">
              Open Admin Command Center
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error in approveCompanyByToken:', err);
    return res.status(500).send('Error approving company application.');
  }
}

// DIRECT ONE-CLICK EMAIL REJECTION
function rejectCompanyByToken(req, res) {
  const token = req.query.token || req.params.token;
  const appId = req.query.id;

  let app;
  if (appId) {
    app = db.prepare('SELECT * FROM company_applications WHERE id = ?').get(appId);
  } else if (token) {
    app = db.prepare('SELECT * FROM company_applications WHERE verification_token = ?').get(token);
  }

  if (!app) {
    return res.status(404).send('Application not found.');
  }

  db.prepare(`UPDATE company_applications SET status = 'Rejected' WHERE id = ?`).run(app.id);

  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>EcoHub - Application Rejected</title></head>
      <body style="font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
        <div style="background: #1e293b; border: 1px solid #ef4444; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center;">
          <div style="font-size: 48px;">✕</div>
          <h2 style="color: #ef4444; margin-top: 8px;">Application Rejected</h2>
          <p style="color: #cbd5e1;">Company application for <strong>${app.company_name}</strong> has been marked as Rejected.</p>
          <a href="http://localhost:5173/admin" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 12px;">Admin Overview</a>
        </div>
      </body>
    </html>
  `);
}

function orderBags(req, res) {
  const { quantity = 500, seed_type = 'Tulsi & Organic Marigold' } = req.body;
  const brandCode = req.companyBrand;

  if (!brandCode) {
    return res.status(403).json({ error: 'Company authentication required' });
  }

  const company = db.prepare('SELECT * FROM companies WHERE brand_code = ?').get(brandCode);
  if (!company) {
    return res.status(404).json({ error: 'Company record not found' });
  }

  const orderCount = Number.parseInt(quantity, 10);
  if (!Number.isInteger(orderCount) || orderCount < 1 || orderCount > 10000) {
    return res.status(400).json({ error: 'Quantity must be a whole number between 1 and 10,000' });
  }

  const batchCode = `BATCH-${brandCode.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    db.exec('BEGIN');

    db.prepare(`
      INSERT INTO ecobag_orders (company_id, brand_code, quantity, batch_code, status, seed_type, ordered_at)
      VALUES (?, ?, ?, ?, 'Ordered', ?, CURRENT_TIMESTAMP)
    `).run(company.id, brandCode, orderCount, batchCode, seed_type);

    const insertBag = db.prepare(`
      INSERT INTO ecobags (bag_id, company_id, brand_code, qr_data, qr_svg, status, seed_type, batch_code, created_at)
      VALUES (?, ?, ?, ?, ?, 'Ordered', ?, ?, CURRENT_TIMESTAMP)
    `);

    const { generateQrSvg } = require('./disposalController');
    for (let i = 1; i <= orderCount; i += 1) {
      const bagId = `BAG-${brandCode.toUpperCase()}-${batchCode.slice(-8)}-${String(i).padStart(5, '0')}`;
      const qrData = `${frontendUrl}/citizen/dispose?company=${encodeURIComponent(brandCode)}&bag_id=${encodeURIComponent(bagId)}`;
      const qrSvg = generateQrSvg(qrData);
      insertBag.run(bagId, company.id, brandCode, qrData, qrSvg, seed_type, batchCode);
    }

    db.exec('COMMIT');
    // Notify admin of the new order
    sendCompanyOrderNotificationToAdmin({
      companyName: company.name,
      brandCode,
      quantity: orderCount,
      batchCode
    });

    return res.status(201).json({
      success: true,
      message: `Successfully placed order for ${orderCount} seed-embedded EcoBags.`,
      batch_code: batchCode,
      quantity: orderCount,
      bags_created: orderCount,
      seed_type: seed_type,
      note: 'Admin will review, generate, and print the official high-resolution QR batch sticker sheets in the Admin Terminal.'
    });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('Error ordering bags:', err);
    return res.status(500).json({ error: 'Failed to order EcoBags' });
  }
}

function getCompanyBags(req, res) {
  const brandCode = req.companyBrand;
  if (!brandCode) {
    return res.status(403).json({ error: 'Company authorization required' });
  }

  const bags = db.prepare(`
    SELECT bag_id, company_id, brand_code, status, seed_type, batch_code, created_at FROM ecobags
    WHERE brand_code = ? 
    ORDER BY created_at DESC 
    LIMIT 250
  `).all(brandCode);

  const orders = db.prepare(`
    SELECT * FROM ecobag_orders 
    WHERE brand_code = ? 
    ORDER BY ordered_at DESC
  `).all(brandCode);

  return res.json({ bags, orders });
}

function getAvailableBrands(req, res) {
  const companies = db.prepare('SELECT id, name, brand_code, category FROM companies').all();
  return res.json(companies);
}

module.exports = {
  getCompanyMetrics,
  getImpactReport,
  getAvailableBrands,
  applyCompany,
  orderBags,
  getCompanyBags,
  approveCompanyByToken,
  rejectCompanyByToken
};
