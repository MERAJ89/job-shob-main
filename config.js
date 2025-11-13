const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env from project root if present, otherwise try server/server.env
const defaultEnvPath = path.resolve(__dirname, '..', '.env');
const serverEnvPath = path.resolve(__dirname, '..', 'server.env');
if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  // One last try: load any default .env (allow process.env set externally)
  dotenv.config();
}

module.exports = {
  port: process.env.PORT || 4000,
  // Provide a sensible fallback for local development if MONGO_URI is not set
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jobshob',
  jwtSecret: process.env.JWT_SECRET || 'please-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  ownerEmail: process.env.OWNER_EMAIL,
  ownerPassword: process.env.OWNER_PASSWORD,
  s3: {
    region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*'
};
