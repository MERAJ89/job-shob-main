const express = require('express');
const router = express.Router();
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { verifyJWT } = require('../middleware/auth');

const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
const changeSchema = Joi.object({ currentPassword: Joi.string().required(), newPassword: Joi.string().min(8).required() });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { email, password } = value;
  const user = await User.findOne({ email }).exec();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  // return token and user info
  res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

// POST /api/auth/change-password
router.post('/change-password', verifyJWT, async (req, res) => {
  const { error, value } = changeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { currentPassword, newPassword } = value;
  const user = await User.findById(req.user.id).exec();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
  const saltRounds = 12;
  const hash = await bcrypt.hash(newPassword, saltRounds);
  user.passwordHash = hash;
  await user.save();
  res.json({ success: true });
});

module.exports = router;
