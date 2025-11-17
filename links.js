const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Link = require('../models/Link');
const { verifyJWT, requireOwner } = require('../middleware/auth');
const sockets = require('../sockets');

const schema = Joi.object({ title: Joi.string().required(), url: Joi.string().uri().required() });

// GET /api/links
router.get('/', async (req, res) => {
  const links = await Link.find().sort({ createdAt: -1 }).lean().exec();
  res.json(links);
});

// POST /api/links (owner)
router.post('/', verifyJWT, requireOwner, async (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const link = await Link.create({ ...value, createdBy: req.user.id });
  sockets.emit('new:link', link);
  res.json(link);
});

// DELETE /api/links/:id (owner)
router.delete('/:id', verifyJWT, requireOwner, async (req, res) => {
  const id = req.params.id;
  const doc = await Link.findByIdAndDelete(id).exec();
  if (doc) sockets.emit('deleted:link', { id });
  res.json({ success: !!doc });
});

module.exports = router;
