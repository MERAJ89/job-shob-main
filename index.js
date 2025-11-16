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
  // Track whether MongoDB connection succeeded. If false, we will run the server
  // in a degraded mode where API endpoints return 503 instead of crashing the process.
  let dbConnected = true;
  // Connect MongoDB (validate URI first)
  if (!config.mongoUri) {
    console.error('Missing MongoDB URI. Please set MONGO_URI in your environment or server/server.env');
    process.exit(1);
  }

  // In production deployments (e.g. Render), we must not fall back to a local MongoDB URI.
  // The value in `config.mongoUri` has a development fallback (mongodb://127.0.0.1:27017/jobshob).
  // If NODE_ENV=production and the URI points to localhost, fail fast with a helpful message.
  if (process.env.NODE_ENV === 'production' && (config.mongoUri.includes('127.0.0.1') || config.mongoUri.includes('localhost'))) {
    console.error('\nDetected production environment while `MONGO_URI` points to localhost.\n' +
      'Render (and other cloud hosts) do not provide a local MongoDB service.\n' +
      "Set the `MONGO_URI` environment variable in your Render dashboard to a MongoDB Atlas connection string or other remote MongoDB instance.\n" +
      "Example: mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/jobshob?retryWrites=true&w=majority\n");
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

    // Do not exit the process here. Start the server in degraded mode so the
    // frontend (static assets) and health endpoint remain available. API routes
    // that require DB access will return 503.
    dbConnected = false;
  }

  // Ensure initial owner user exists if env provided and the DB connection is available
  if (dbConnected && config.ownerEmail && config.ownerPassword) {
    try {
      const exists = await User.findOne({ email: config.ownerEmail }).exec();
      if (!exists) {
        const saltRounds = 12;
        const hash = await bcrypt.hash(config.ownerPassword, saltRounds);
        await User.create({ email: config.ownerEmail, passwordHash: hash, role: 'owner' });
        console.log('Initial owner user created:', config.ownerEmail);
      }
    } catch (err) {
      console.error('Failed to ensure initial owner user:', err && err.message ? err.message : err);
    }
  } else if (!dbConnected) {
    console.warn('Database not connected — skipping initial owner user creation.');
  }

  const app = express();
  // If DB is not connected, short-circuit API requests with a 503 so callers
  // get a clear error instead of causing unhandled exceptions from model code.
  app.use('/api', (req, res, next) => {
    if (!dbConnected) {
      return res.status(503).json({ ok: false, error: 'Service temporarily unavailable: database connection failed' });
    }
    next();
  });
  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, { cors: { origin: config.frontendOrigin } });
  sockets.init(io);

  // Basic middlewares
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  // Allow CORS from all origins for YouTube embeds
  app.use(cors({ origin: '*', credentials: false }));

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
