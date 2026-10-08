const crypto = require('node:crypto');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ecohub-super-secret-production-key-2026';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function signToken(payload, expiresInSeconds = 86400 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare('SELECT id, name, email, role, brand_code FROM users WHERE id = ?').get(decoded.id);
  if (!user && decoded.role !== 'collection_centre' && decoded.role !== 'company') {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user ? { ...user } : {
    id: decoded.id,
    name: decoded.name || 'Authorized Partner',
    email: decoded.email,
    role: decoded.role,
    brand_code: decoded.brand_code || null,
    centre_id: decoded.centre_id
  };

  if (decoded.role === 'company') {
    req.user.role = 'company';
    if (decoded.brand_code) req.user.brand_code = decoded.brand_code;
    if (decoded.name) req.user.name = decoded.name;
  }
  if (decoded.role === 'collection_centre') {
    req.user.role = 'collection_centre';
    if (decoded.centre_id) req.user.centre_id = decoded.centre_id;
  }
  if (decoded.centre_id) {
    req.user.centre_id = decoded.centre_id;
  }
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        error: `Access forbidden: requires one of roles [${roles.join(', ')}]`
      });
    }
    next();
  };
}

// Strict Company Tenant Isolation Middleware
function enforceCompanyPrivacy(req, res, next) {
  if (req.user.role === 'admin') {
    // Admin can access all or query any company
    return next();
  }

  if (req.user.role !== 'company') {
    return res.status(403).json({ error: 'Company authorization required' });
  }

  if (!req.user.brand_code) {
    return res.status(403).json({ error: 'No brand assigned to this company account' });
  }

  // Force brand_code to the authenticated company's brand_code
  req.companyBrand = req.user.brand_code;
  next();
}

module.exports = {
  signToken,
  verifyToken,
  authenticate,
  requireRole,
  enforceCompanyPrivacy
};
