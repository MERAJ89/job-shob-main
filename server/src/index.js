/*
  Entry point: Express server with Socket.IO, MongoDB connection, rate limiting, helmet, and routes.
*/
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const sockets = require('./sockets');

const authRoutes = require('./routes/auth');
const linksRoutes = require('./routes/links');
const videosRoutes = require('./routes/videos');
const pdfsRoutes = require('./routes/pdfs');
const contactRoutes = require('./routes/contact');

const User = require('./models/User');
const bcrypt = require('bcrypt');

async function start() {
  // Connect MongoDB (validate URI first)
  if (!config.mongoUri) {
    console.error('Missing MongoDB URI. Please set MONGO_URI in your environment or server/server.env');
    process.exit(1);
  }

  try {
    // serverSelectionTimeoutMS will fail fast if MongoDB is unreachable
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('MongoDB connection error:', msg);

    // Helpful diagnostic for common Atlas DNS SRV failures
    if (msg.includes('querySrv ENOTFOUND') || msg.includes('ENOTFOUND')) {
      console.error('\nDetected DNS SRV lookup failure for your MongoDB connection string.');
      console.error('This usually means one of:');
      console.error('- The MONGO_URI environment variable is missing or contains placeholders (e.g. <username>, <password>, <cluster>).');
      console.error('- The Atlas cluster hostname is incorrect or not reachable from the hosting environment.');
      console.error('- Network access in MongoDB Atlas is restricted (no IP whitelist for Render).');
      console.error('\nSuggested fixes:');
      console.error("1) In your Render dashboard, set the `MONGO_URI` env var to the exact Atlas connection string, for example:");
      console.error("   mongodb+srv://username:password@your-cluster-name.mongodb.net/jobshob?retryWrites=true&w=majority");
      console.error("   -> Replace 'username', 'password' and 'your-cluster-name' with real values (remove angle brackets).\n");
      console.error("2) In MongoDB Atlas UI, go to Network Access and add an IP access entry. For testing you can allow '0.0.0.0/0' (allows all IPs).\n");
      console.error("3) If your deployment environment blocks SRV DNS lookups, try using the standard connection string (non-SRV) provided in Atlas under 'Connect -> Drivers -> More Options' (it lists host:port style URIs).");

      if (process.env.DEBUG_MONGO_URI === 'true') {
        const val = config.mongoUri || process.env.MONGO_URI || '<not-set>';
        // mask password if present
        const masked = val.replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/, (m, p, u, pw) => `${p}${u}:*****@`);
        console.error('\nCurrent MONGO_URI (masked):', masked);
      }
    }

    process.exit(1);
  }

  // Ensure initial owner user exists if env provided
  if (config.ownerEmail && config.ownerPassword) {
    const exists = await User.findOne({ email: config.ownerEmail }).exec();
    if (!exists) {
      const saltRounds = 12;
      const hash = await bcrypt.hash(config.ownerPassword, saltRounds);
      await User.create({ email: config.ownerEmail, passwordHash: hash, role: 'owner' });
      console.log('Initial owner user created:', config.ownerEmail);
    }
  }

  const app = express();
  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, { cors: { origin: config.frontendOrigin } });
  sockets.init(io);

  // Basic middlewares
  app.use(helmet());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: config.frontendOrigin }));

  // Rate limiter
  const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
  app.use(limiter);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/links', linksRoutes);
  app.use('/api/videos', videosRoutes);
  app.use('/api/pdfs', pdfsRoutes);
  app.use('/api/contact', contactRoutes);

  // Health
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Serve frontend static files from the workspace root (two levels up from src)
  const frontendRoot = path.resolve(__dirname, '..', '..');
  app.use(express.static(frontendRoot));

  // Fallback to index.html for SPA routes (only for non-API requests)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendRoot, 'index.html'));
  });

  // Socket example: log connections
  io.on('connection', (socket) => {
    console.log('Client connected', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected', socket.id));
  });

  const port = config.port || 4000;
  server.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch(err => { console.error(err); process.exit(1); });
