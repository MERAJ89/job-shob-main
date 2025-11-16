const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env from server directory first, then project root
const serverEnvPath = path.resolve(__dirname, '..', 'server.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

if (fs.existsSync(serverEnvPath)) {
  console.log('Loading env from:', serverEnvPath);
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  console.log('Loading env from:', rootEnvPath);
  dotenv.config({ path: rootEnvPath });
} else {
  console.log('No .env or server.env found, using process.env');
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
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.AWS_ENDPOINT_URL // For LocalStack or S3-compatible services
  },
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*'
};
