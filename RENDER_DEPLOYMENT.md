# Render Deployment Guide for Job Shob Backend

## Quick Start

### 1. Prerequisites
- GitHub account with your code pushed to `MERAJ89/job-shob-main`
- MongoDB Atlas account (or local MongoDB for development)
- Render account at https://render.com

### 2. Deploy Backend on Render

#### Step A: Create a Web Service on Render

1. Go to https://render.com and log in
2. Click **"New +"** button → Select **"Web Service"**
3. **Connect your GitHub repo:**
   - Click "Connect account" and authorize GitHub
   - Search for and select `job-shob-main`
   - Click "Connect"

4. **Configure the service:**
   - **Name**: `job-shob-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Region**: Select closest to your users
   - **Plan**: Free tier (recommended for testing)

5. Click **"Create Web Service"**

#### Step B: Add Environment Variables

After the service is created, go to the **Environment** tab and add:

| Key | Value | Example |
|-----|-------|---------|
| `PORT` | `4000` | `4000` |
| `NODE_ENV` | `production` | `production` |
| `MONGO_URI` | Your MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/jobshob?retryWrites=true&w=majority` |
| `JWT_SECRET` | Secret key (change this!) | `your-secret-key-here` |
| `OWNER_EMAIL` | Owner email | `owner@jobshob.com` |
| `OWNER_PASSWORD` | Owner password (change this!) | `securePassword123` |
| `FRONTEND_ORIGIN` | Frontend URL (update after frontend deploy) | `https://yourfrontend.vercel.app` |
| `S3_REGION` | AWS region (optional) | `us-east-1` |
| `S3_BUCKET` | S3 bucket name (optional) | `your-bucket-name` |
| `AWS_ACCESS_KEY_ID` | AWS key (optional) | `your-key` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (optional) | `your-secret` |

6. Click **"Save"**

#### Step C: Deploy

Render will automatically start building and deploying. Watch the logs:
- **Build logs**: Should show `npm install` completing successfully
- **Deploy logs**: Should show `Connected to MongoDB` and `Server running on port 4000`

### 3. Set Up MongoDB Atlas (Production Database)

#### Create a Free Cluster:

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up or log in
3. Click **"Create"** (or **"Build a Database"**)
4. Choose **Shared Tier** (Free)
5. Choose your cloud provider and region
6. Click **"Create Cluster"**

#### Get Your Connection String:

1. Click **"Connect"** button
2. Select **"Drivers"** → **Node.js**
3. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/jobshob?retryWrites=true&w=majority
   ```
4. Replace `username`, `password`, and `jobshob` with your values
5. Paste this into Render's `MONGO_URI` environment variable

#### Allow Render IP Access:

1. In MongoDB Atlas, go to **Network Access**
2. Click **"Add IP Address"**
3. Select **"Allow Access from Anywhere"** (Render's IPs vary)
4. Click **"Confirm"**

**Note**: For production, use Render's fixed IP and whitelist only that.

### 4. Verify Deployment

Once deployed, test your backend:

```bash
# Health check
curl https://your-service.onrender.com/health

# Should return:
# {"ok":true}
```

### 5. Frontend Configuration

When deploying your frontend, set:
```
REACT_APP_API_BASE_URL=https://your-service.onrender.com
```

This allows the frontend to communicate with your Render backend.

---

## Troubleshooting

### Build Failed: "Cannot find module"
- **Solution**: Ensure `server/package.json` exists and has all dependencies
- Run locally: `cd server && npm install && npm start`

### Build Failed: "No start script"
- **Solution**: Verify `server/package.json` has `"start": "node src/index.js"`

### Build Failed: "Cannot find index.js"
- **Solution**: Ensure file is at `server/src/index.js` (not `server/index.js`)

### Server starts but then crashes
- **Solution**: Check MongoDB URI is correct
- Test locally with the MongoDB Atlas connection string first

### "connection ECONNREFUSED"
- **Solution**: MongoDB Atlas cluster might not be accessible
- Check Network Access whitelist in MongoDB Atlas
- Verify MONGO_URI includes username and password

### DNS SRV error: "querySrv ENOTFOUND _mongodb._tcp.cluster.mongodb.net"

If during deployment you see an error like:

```
querySrv ENOTFOUND _mongodb._tcp.cluster.mongodb.net
```

This means the DNS SRV lookup for your Atlas cluster failed. Common causes and fixes:

- Ensure `MONGO_URI` is set exactly to the Atlas connection string (no placeholders). Example:

   mongodb+srv://username:password@your-cluster-name.mongodb.net/jobshob?retryWrites=true&w=majority

   Replace `username`, `password`, and `your-cluster-name` (do NOT include `<` or `>` characters).

- In MongoDB Atlas, go to **Network Access** and add an IP whitelist entry. For quick testing you can add `0.0.0.0/0` (allows all), but for production whitelist Render's IPs or use a private network.

- If your hosting environment has restricted DNS or blocks SRV lookups, use the non-SRV connection string (mongodb://) provided by Atlas under **Connect → Drivers → More Options**.

- To debug, temporarily set an env variable in Render: `DEBUG_MONGO_URI=true` — the server will print the masked `MONGO_URI` into the logs to help diagnose formatting issues.

If you need help copying the correct connection string from Atlas, tell me and I will provide the exact steps.

---

## Environment Variables Reference

### Required
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens

### Optional but Recommended
- `NODE_ENV` - Should be `production`
- `FRONTEND_ORIGIN` - CORS origin for frontend
- `OWNER_EMAIL` & `OWNER_PASSWORD` - Initial owner credentials

### AWS S3 (if using file uploads)
- `S3_REGION` - AWS region
- `S3_BUCKET` - Bucket name
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

---

## Re-deploying After Changes

After making code changes:

```bash
cd "c:\Users\user\Desktop\Job Shob Main"
git add .
git commit -m "Your commit message"
git push origin main
```

Render will automatically rebuild and deploy!

---

## Next: Deploy Frontend

See `FRONTEND_DEPLOYMENT.md` for deploying to Vercel or Netlify.
