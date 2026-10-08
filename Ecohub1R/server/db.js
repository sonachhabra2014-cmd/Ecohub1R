const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'ecohub.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      brand_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      phone TEXT,
      address TEXT,
      city TEXT,
      pincode TEXT,
      sustainability_level TEXT DEFAULT 'Green Advocate',
      eco_rank INTEGER DEFAULT 1,
      badges TEXT DEFAULT '["Eco Certified"]',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand_code TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      category TEXT DEFAULT 'Consumer Electronics',
      csr_budget_inr REAL DEFAULT 5000000,
      sustainability_target_tons REAL DEFAULT 150.0
    );

    CREATE TABLE IF NOT EXISTS collection_centres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT,
      license_no TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS disposals (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      user_email TEXT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand_code TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      item_condition TEXT DEFAULT 'Used',
      estimated_weight_kg REAL DEFAULT 1.5,
      photo_url TEXT,
      collection_centre_id INTEGER NOT NULL,
      collection_centre_name TEXT NOT NULL,
      collection_centre_address TEXT,
      status TEXT DEFAULT 'Pending Disposal',
      qr_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_at DATETIME,
      verified_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disposal_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      video_filename TEXT,
      video_format TEXT,
      status TEXT DEFAULT 'Pending',
      plant_detected INTEGER DEFAULT 0,
      watering_detected INTEGER DEFAULT 0,
      authenticity_score REAL DEFAULT 0.0,
      duration_seconds REAL DEFAULT 0.0,
      ai_notes TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER PRIMARY KEY,
      ecocredits_balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand_code TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      discount_title TEXT NOT NULL,
      discount_description TEXT,
      expiry_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS impact_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      brand_code TEXT NOT NULL,
      report_title TEXT NOT NULL,
      report_year INTEGER DEFAULT 2026,
      total_ewaste_kg REAL NOT NULL,
      verified_disposals INTEGER NOT NULL,
      trees_watered INTEGER NOT NULL,
      co2_saved_kg REAL NOT NULL,
      sustainability_score INTEGER NOT NULL,
      verification_hash TEXT NOT NULL,
      qr_verification_url TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      cta_link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      template_name TEXT NOT NULL,
      body_html TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Delivered'
    );

    CREATE TABLE IF NOT EXISTS company_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      brand_code TEXT UNIQUE NOT NULL,
      registration_number TEXT,
      company_type TEXT,
      official_email TEXT NOT NULL,
      contact_number TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pin_code TEXT,
      representative_name TEXT,
      designation TEXT,
      representative_email TEXT,
      e_waste_types TEXT,
      monthly_capacity TEXT,
      authorization_number TEXT,
      facility_address TEXT,
      status TEXT DEFAULT 'Pending',
      assigned_company_id TEXT,
      assigned_password TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS ecobag_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      brand_code TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      batch_code TEXT NOT NULL,
      status TEXT DEFAULT 'Fulfilled',
      ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ecobags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bag_id TEXT UNIQUE NOT NULL,
      company_id INTEGER NOT NULL,
      brand_code TEXT NOT NULL,
      qr_data TEXT NOT NULL,
      qr_svg TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collection_centre_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      centre_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      latitude REAL DEFAULT 28.62,
      longitude REAL DEFAULT 77.22,
      license_number TEXT,
      officer_name TEXT,
      capacity_info TEXT,
      status TEXT DEFAULT 'Pending',
      verification_token TEXT,
      assigned_code TEXT,
      assigned_password TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN bag_id TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN plant_day_count INTEGER DEFAULT 0;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN last_watered_date TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN seed_type TEXT DEFAULT 'Tulsi & Medicinal Herbs';");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN user_phone TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN capture_metadata TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE collection_centres ADD COLUMN password_hash TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE collection_centres ADD COLUMN email TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE collection_centres ADD COLUMN officer_name TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE collection_centres ADD COLUMN assigned_code TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN day_number INTEGER DEFAULT 1;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN gov_compliance_id TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN gov_compliance_hash TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN soil_score REAL DEFAULT 0.0;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN water_dynamics_score REAL DEFAULT 0.0;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN anti_tamper_score REAL DEFAULT 0.0;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE challenges ADD COLUMN gov_audit_notes TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE ecobag_orders ADD COLUMN seed_type TEXT DEFAULT 'Tulsi & Organic Marigold';");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE ecobags ADD COLUMN seed_type TEXT DEFAULT 'Tulsi & Organic Marigold';");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE ecobags ADD COLUMN batch_code TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE company_applications ADD COLUMN verification_token TEXT;");
  } catch (e) {}

  // Evidence Verification & Trust Score migrations
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN centre_photo_url TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN centre_gps_lat REAL;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN centre_gps_lng REAL;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN centre_gps_accuracy REAL;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN verification_timestamp DATETIME;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN device_category_matched INTEGER DEFAULT 1;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN trust_score INTEGER DEFAULT 96;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN trust_factors TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN is_locked INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN reward_points INTEGER DEFAULT 30;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN verification_status TEXT DEFAULT 'Pending Verification';");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN registration_hash TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN user_photo_hash TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN centre_photo_hash TEXT;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE disposals ADD COLUMN user_address TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN serial_number TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN product_id_image TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN evidence_product_id_url TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN confidence_score INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN verification_checks TEXT;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE disposals ADD COLUMN waste_record_created_at DATETIME;");
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trust_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disposal_id TEXT NOT NULL,
        total_score INTEGER NOT NULL,
        photo_similarity_score REAL DEFAULT 0,
        gps_proximity_score REAL DEFAULT 0,
        timestamp_validity_score REAL DEFAULT 0,
        category_match_score REAL DEFAULT 0,
        hash_integrity_score REAL DEFAULT 0,
        diagnostics_json TEXT,
        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disposal_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        ip_address TEXT,
        payload_snapshot TEXT NOT NULL,
        previous_log_hash TEXT,
        current_log_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}


  // Collection centre applications table migration (safe no-op if already exists)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS collection_centre_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        centre_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        latitude REAL DEFAULT 28.62,
        longitude REAL DEFAULT 77.22,
        license_number TEXT,
        officer_name TEXT,
        capacity_info TEXT,
        status TEXT DEFAULT 'Pending',
        verification_token TEXT,
        assigned_code TEXT,
        assigned_password TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME
      )
    `);
  } catch (e) {}

  clearSeededDataOnce();
  seedDefaultData();
}

function clearSeededDataOnce() {
  const setting = db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'real_time_baseline' ").get();
  if (setting) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      DELETE FROM wallet_transactions;
      DELETE FROM coupons;
      DELETE FROM wallets;
      DELETE FROM notifications;
      DELETE FROM challenges;
      DELETE FROM disposals;
      DELETE FROM ecobags;
      DELETE FROM ecobag_orders;
      DELETE FROM email_logs;
      DELETE FROM impact_reports;
      DELETE FROM collection_centre_applications;
      DELETE FROM company_applications;
      DELETE FROM collection_centres;
      DELETE FROM companies;
      DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE role != 'admin');
      DELETE FROM users WHERE role != 'admin';
      INSERT INTO system_settings (setting_key, setting_value)
      VALUES ('real_time_baseline', 'initialized');
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedDefaultData() {
  // Only the administrator account is created automatically.
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (usersCount === 0) {
    const defaultPassword = hashPassword('EcoHub@2026');

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, brand_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    const adminRes = insertUser.run('EcoHub Administrator', 'admin@ecohub.org', defaultPassword, 'admin', null);
    db.prepare(`INSERT INTO user_profiles (user_id, phone, city) VALUES (?, ?, ?)`).run(Number(adminRes.lastInsertRowid), '+91 9999900000', 'New Delhi');
  }

  // No fake seeded data — companies and centres are only created via real registration + admin approval
}

// Initialize on module load
initDatabase();

module.exports = {
  db,
  hashPassword,
};
