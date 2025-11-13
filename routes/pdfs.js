const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Pdf = require('../models/Pdf');
const { verifyJWT, requireOwner } = require('../middleware/auth');
const { createPresignedUploadUrl, createSignedGetUrl, deleteObject } = require('../utils/s3');
const sockets = require('../sockets');
const config = require('../config');

const presignSchema = Joi.object({ filename: Joi.string().required(), contentType: Joi.string().required(), size: Joi.number().max(20 * 1024 * 1024).required() });
const saveSchema = Joi.object({ title: Joi.string().required(), fileKey: Joi.string().required(), filename: Joi.string().required(), contentType: Joi.string().required(), size: Joi.number().required() });

// POST /api/pdfs/presign (owner)
router.post('/presign', verifyJWT, requireOwner, async (req, res) => {
  const { error, value } = presignSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { filename, contentType } = value;
  if (!contentType.includes('pdf')) return res.status(400).json({ error: 'contentType must be a PDF' });
  const key = `pdfs/${Date.now().toString(36)}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const uploadUrl = await createPresignedUploadUrl({ key, contentType, expiresIn: 900 });
  const downloadUrl = await createSignedGetUrl({ key, expiresIn: 3600 });
  res.json({ uploadUrl, fileKey: key, downloadUrl });
});

// POST /api/pdfs (owner) - save metadata after upload
router.post('/', verifyJWT, requireOwner, async (req, res) => {
  const { error, value } = saveSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { title, fileKey, filename, contentType, size } = value;
  const pdf = await Pdf.create({ title, fileKey, filename, contentType, size, createdBy: req.user.id });
  sockets.emit('new:pdf', pdf);
  res.json(pdf);
});

// GET /api/pdfs (public)
router.get('/', async (req, res) => {
  const items = await Pdf.find().sort({ createdAt: -1 }).lean().exec();
  // attach signed GET url for each entry
  const data = await Promise.all(items.map(async p => {
    try {
      const url = await createSignedGetUrl({ key: p.fileKey, expiresIn: 3600 });
      return { ...p, downloadUrl: url };
    } catch (err) {
      return { ...p };
    }
  }));
  res.json(data);
});

// DELETE /api/pdfs/:id (owner) - delete metadata and S3 object
router.delete('/:id', verifyJWT, requireOwner, async (req, res) => {
  const id = req.params.id;
  const p = await Pdf.findById(id).exec();
  if (!p) return res.status(404).json({ error: 'Not found' });
  // delete S3 object
  try { await deleteObject(p.fileKey); } catch (err) { console.error('Failed to delete S3 object', err); }
  await Pdf.findByIdAndDelete(id).exec();
  sockets.emit('deleted:pdf', { id });
  res.json({ success: true });
});

module.exports = router;
