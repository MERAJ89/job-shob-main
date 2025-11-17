const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Pdf = require('../models/Pdf');
const { verifyJWT, requireOwner } = require('../middleware/auth');
const { createPresignedUploadUrl, createSignedGetUrl, deleteObject } = require('../utils/s3');
const localPdfStorage = require('../utils/localPdfStorage');
const sockets = require('../sockets');
const config = require('../config');

const presignSchema = Joi.object({ filename: Joi.string().required(), contentType: Joi.string().required(), size: Joi.number().max(20 * 1024 * 1024).required() });
const saveSchema = Joi.object({ title: Joi.string().required(), fileKey: Joi.string().required(), filename: Joi.string().required(), contentType: Joi.string().required(), size: Joi.number().required() });

// Apply raw body parser only to PUT /upload endpoint
router.use('/upload/:fileKey', express.raw({ type: '*/*', limit: '20mb' }));

// POST /api/pdfs/presign (owner)
router.post('/presign', verifyJWT, requireOwner, async (req, res) => {
  try {
    console.log('Presign endpoint called');
    const { error, value } = presignSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    const { filename, contentType, size } = value;
    console.log('Presign request:', { filename, contentType, size });
    
    // Create a unique key with timestamp to avoid collisions
    const timestamp = Date.now();
    const fileKey = `pdfs/${timestamp}-${filename}`;
    
    // Check if S3 is properly configured
    const s3Configured = config.s3 && config.s3.bucket && config.s3.region && config.s3.accessKeyId && config.s3.secretAccessKey;
    console.log('S3Configured:', s3Configured);
    
    if (s3Configured) {
      // Use S3
      const uploadUrl = await createPresignedUploadUrl({ key: fileKey, contentType, expiresIn: 900 });
      console.log('Returning S3 URL');
      res.json({ uploadUrl, fileKey, storage: 's3' });
    } else {
      // Fallback to local storage
      const uploadUrl = localPdfStorage.createLocalPresignedUploadUrl({ key: fileKey });
      console.log('Returning local URL:', uploadUrl);
      res.json({ uploadUrl, fileKey, storage: 'local' });
    }
  } catch (err) {
    console.error('Presign error:', err);
    res.status(500).json({ error: 'Failed to generate presigned URL: ' + err.message });
  }
});

// PUT /api/pdfs/upload/:fileKey (owner) - handle local file upload
// IMPORTANT: This must come BEFORE the GET /:fileKey route to avoid route conflicts
router.put('/upload/:fileKey', verifyJWT, requireOwner, async (req, res) => {
  try {
    const fileKey = decodeURIComponent(req.params.fileKey);
    console.log('PUT /upload/ received for fileKey:', fileKey);
    console.log('Body type:', typeof req.body, 'Body is Buffer:', Buffer.isBuffer(req.body));
    console.log('Body size:', req.body ? req.body.length : 'undefined');
    
    // req.body should already be a Buffer due to express.raw() middleware
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    
    if (buffer.length === 0) {
      console.error('No data received in buffer');
      return res.status(400).json({ error: 'No file data received' });
    }
    
    const contentType = req.get('content-type') || 'application/pdf';
    console.log('Content-Type:', contentType, 'Buffer size:', buffer.length);
    
    await localPdfStorage.handleLocalFileUpload(fileKey, buffer, contentType);
    console.log('File saved successfully');
    res.json({ success: true, size: buffer.length });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to save file: ' + err.message });
  }
});

// GET /api/pdfs/download/:fileKey (public) - download a stored PDF
router.get('/download/:fileKey', async (req, res) => {
  try {
    const fileKey = decodeURIComponent(req.params.fileKey);
    const stored = localPdfStorage.getLocalStoredFile(fileKey);
    if (!stored) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    res.set('Content-Type', stored.contentType);
    res.set('Content-Disposition', `attachment; filename="${fileKey.split('/').pop()}"`);
    res.send(stored.buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
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
  const s3Configured = config.s3 && config.s3.bucket && config.s3.region && config.s3.accessKeyId && config.s3.secretAccessKey;
  
  // attach signed GET url for each entry
  const data = await Promise.all(items.map(async p => {
    try {
      if (s3Configured) {
        const url = await createSignedGetUrl({ key: p.fileKey, expiresIn: 3600 });
        return { ...p, downloadUrl: url };
      } else {
        // Use local storage endpoint
        return { ...p, downloadUrl: `/api/pdfs/download/${encodeURIComponent(p.fileKey)}` };
      }
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
  
  const s3Configured = config.s3 && config.s3.bucket && config.s3.region && config.s3.accessKeyId && config.s3.secretAccessKey;
  
  // delete object from S3 or local storage
  try {
    if (s3Configured) {
      await deleteObject(p.fileKey);
    } else {
      localPdfStorage.deleteLocalStoredFile(p.fileKey);
    }
  } catch (err) {
    console.error('Failed to delete PDF object', err);
  }
  await Pdf.findByIdAndDelete(id).exec();
  sockets.emit('deleted:pdf', { id });
  res.json({ success: true });
});

module.exports = router;
