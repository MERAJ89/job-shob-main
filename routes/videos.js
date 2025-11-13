const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Video = require('../models/Video');
const { verifyJWT, requireOwner } = require('../middleware/auth');
const sockets = require('../sockets');

const schema = Joi.object({ title: Joi.string().required(), youtubeUrlOrId: Joi.string().required() });

function extractYouTubeID(input) {
  if (!input) return '';
  const plain = input.trim();
  const idMatch = plain.match(/^[A-Za-z0-9_-]{6,}$/);
  if (idMatch) return plain;
  const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
  const m = plain.match(regex);
  return m ? m[1] : '';
}

// GET /api/videos
router.get('/', async (req, res) => {
  const videos = await Video.find().sort({ createdAt: -1 }).lean().exec();
  res.json(videos);
});

// POST /api/videos (owner)
router.post('/', verifyJWT, requireOwner, async (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const ytId = extractYouTubeID(value.youtubeUrlOrId);
  if (!ytId) return res.status(400).json({ error: 'Unable to extract YouTube ID' });
  const video = await Video.create({ title: value.title, youtubeId: ytId, createdBy: req.user.id });
  sockets.emit('new:video', video);
  res.json(video);
});

// DELETE /api/videos/:id
router.delete('/:id', verifyJWT, requireOwner, async (req, res) => {
  const id = req.params.id;
  const doc = await Video.findByIdAndDelete(id).exec();
  if (doc) sockets.emit('deleted:video', { id });
  res.json({ success: !!doc });
});

// POST /api/videos/:id/pin (owner) - pin single video
router.post('/:id/pin', verifyJWT, requireOwner, async (req, res) => {
  const id = req.params.id;
  // Unpin all
  await Video.updateMany({}, { $set: { pinned: false } }).exec();
  const vid = await Video.findByIdAndUpdate(id, { $set: { pinned: true } }, { new: true }).exec();
  sockets.emit('pinned:video', vid);
  res.json(vid);
});

module.exports = router;
