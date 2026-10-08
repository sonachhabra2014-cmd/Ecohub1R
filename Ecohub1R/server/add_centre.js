const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const db = new DatabaseSync(path.join(__dirname, 'ecohub.sqlite'));

// Check existing records
const all = db.prepare('SELECT id, name, status, address, email FROM collection_centres').all();
console.log('\nAll existing centres (' + all.length + '):');
console.log(JSON.stringify(all, null, 2));

// Also check what the API filters on
const active = db.prepare("SELECT id, name, status FROM collection_centres WHERE status = 'Active'").all();
console.log('\nActive centres:', active.length);

// Insert a sample centre if none are active
if (active.length === 0) {
  const hash = crypto.createHash('sha256').update('Centre@123').digest('hex');
  const insert = db.prepare(`
    INSERT INTO collection_centres (name, address, latitude, longitude, phone, license_no, status, password_hash, email, officer_name, assigned_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(
    'EcoHub Green Centre - Delhi',
    '12, Connaught Place, New Delhi, Delhi 110001',
    28.6315,
    77.2167,
    '+91-11-23456789',
    'CPCB-REG-DL-001',
    'Active',
    hash,
    'centre@ecohub.in',
    'Rajesh Kumar',
    'CC-DL-001'
  );
  console.log('\n✅ Inserted sample centre with id:', result.lastInsertRowid);
} else {
  console.log('\n✅ Already have active centres — no insert needed.');
}
