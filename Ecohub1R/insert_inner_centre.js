const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const db = new DatabaseSync('c:/Users/Dell/Downloads/Ecohub1R/Ecohub1R/Ecohub1R/server/ecohub.sqlite');
const hash = crypto.createHash('sha256').update('Centre@123').digest('hex');
db.prepare("INSERT INTO collection_centres (name, address, latitude, longitude, phone, license_no, status, password_hash, email, officer_name, assigned_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
  'EcoHub Green Centre - Delhi',
  '12, Connaught Place, New Delhi, Delhi 110001',
  28.6315,
  77.2167,
  '+91-11-23456789',
  'CPCB-REG-DL-001',
  'active',
  hash,
  'centre@ecohub.in',
  'Rajesh Kumar',
  'CC-DL-001'
);
console.log('Inserted centre into inner DB');
