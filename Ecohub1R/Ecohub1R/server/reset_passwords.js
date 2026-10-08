const { db, hashPassword } = require('./db');
const newPassword = 'EcoHub@2026';
const newHash = hashPassword(newPassword);

db.prepare("UPDATE users SET password_hash = ? WHERE role = 'company'").run(newHash);
console.log("Passwords for all companies have been reset to: " + newPassword);
