const mongoose = require('mongoose');

const pdfSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fileKey: { type: String, required: true },
  filename: { type: String },
  contentType: { type: String },
  size: { type: Number },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Pdf', pdfSchema);
