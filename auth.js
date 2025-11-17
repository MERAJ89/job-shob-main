const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

async function verifyJWT(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const payload = jwt.verify(token, config.jwtSecret);
    // Attach user id and role
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Forbidden: owner only' });
  next();
}

module.exports = { verifyJWT, requireOwner };
