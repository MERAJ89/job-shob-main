const express = require('express');
const router = express.Router();
const Joi = require('joi');
const ContactMessage = require('../models/ContactMessage');

const schema = Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), phone: Joi.string().allow('', null), message: Joi.string().required() });

// POST /api/contact
router.post('/', async (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const doc = await ContactMessage.create(value);
  res.json({ success: true, id: doc._id });
});

module.exports = router;
