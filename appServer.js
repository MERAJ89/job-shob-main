/*
  Minimal test server utility to start an instance of the app for tests.
  Uses the same entrypoint but exposes the http server instance for supertest.
*/
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const config = require('../config');

const authRoutes = require('../routes/auth');
const linksRoutes = require('../routes/links');
const videosRoutes = require('../routes/videos');
const pdfsRoutes = require('../routes/pdfs');
const contactRoutes = require('../routes/contact');

async function startTestServer() {
  if (!config.mongoUri) {
    throw new Error('Missing MongoDB URI for tests. Set MONGO_URI in your test environment or server/server.env');
  }

  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error('Failed to connect to MongoDB in test server:', err && err.message ? err.message : err);
    throw err;
  }
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/links', linksRoutes);
  app.use('/api/videos', videosRoutes);
  app.use('/api/pdfs', pdfsRoutes);
  app.use('/api/contact', contactRoutes);
  app.get('/health', (req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  return server;
}

async function stopTestServer() {
  await mongoose.disconnect();
}

module.exports = { startTestServer, stopTestServer };
