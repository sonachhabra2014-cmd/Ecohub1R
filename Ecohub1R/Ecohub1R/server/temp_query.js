const { db } = require('./db');
const users = db.prepare("SELECT email, role, brand_code FROM users").all();
console.log(users);
