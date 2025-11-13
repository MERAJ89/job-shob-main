# Job Shob — Server

This repository contains a production-ready backend scaffold for the Job Shob single-page app.

Features
- Node.js + Express API
- MongoDB (Mongoose)
- JWT authentication (bcrypt)
- AWS S3 presigned uploads (SDK v3)
- Socket.IO real-time updates
- Basic validation with Joi
- Rate limiting and security headers (helmet)

## Quick start

1. Copy `.env.example` to `.env` and fill values (Mongo URI, JWT_SECRET, S3 settings, FRONTEND_ORIGIN)

2. Install dependencies:

```powershell
cd server
npm install
```

3. Start dev server:

```powershell
npm run dev
```

The server will create an initial owner user if `OWNER_EMAIL` and `OWNER_PASSWORD` are present in env.

## Environment variables
See `.env.example` for required variables. Important:
- `JWT_SECRET` should be a strong secret.
- `S3_BUCKET` and AWS keys must be valid to use presigned uploads.

## S3 CORS
Your S3 bucket needs CORS allowing PUT from your frontend origin for presigned uploads. Example CORS rule:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

## Tests

```powershell
npm test
```

## Notes
- For production deploy, use HTTPS (TLS), set strict CORS, and keep environment secrets safe.
