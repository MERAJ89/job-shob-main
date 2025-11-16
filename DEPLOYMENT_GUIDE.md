# Job Shob Website - Complete Deployment Guide

## ✅ Status
- ✅ Code is committed to local Git repo
- ⏳ Need to push to GitHub
- ⏳ Deploy backend on Render
- ⏳ Deploy frontend on Vercel
- ⏳ Configure MongoDB Atlas

---

## 🚀 Step 1: Push to GitHub

### 1.1 Create GitHub Repository
1. Go to https://github.com/new
2. Create repository:
   - **Repository name:** `job-shob` (or your choice)
   - **Description:** "Real-time job notifications website with owner panel"
   - **Public** (so you can deploy for free)
   - Click **"Create repository"**

### 1.2 Get GitHub Repository URL
After creating, you'll see a HTTPS URL like:
```
https://github.com/YOUR_USERNAME/job-shob.git
```

### 1.3 Push Local Code to GitHub
Run these commands in PowerShell (in your project directory):

```powershell
cd "C:\Users\user\Desktop\Job Shob Main"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/job-shob.git

# Rename branch to main
git branch -M main

# Push code
git push -u origin main
```

✅ Your code is now on GitHub!

---

## 📦 Step 2: Deploy Backend on Render

### 2.1 Create Render Account
1. Go to https://render.com
2. Click **"Sign up"** → Create account (can use GitHub login)

### 2.2 Create Web Service
1. Click **"New +"** in top-right
2. Select **"Web Service"**
3. Click **"Connect"** next to your GitHub repo (`job-shob`)
4. Fill in:
   - **Name:** `job-shob-api` (or `job-shob-backend`)
   - **Runtime:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Root Directory:** `.` (leave empty)

### 2.3 Set Environment Variables
1. In the Render dashboard, go to your service
2. Click **"Environment"** tab
3. Add these variables (click "Add Environment Variable" for each):

```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/jobshob
JWT_SECRET=jobshob_secret_key_here_change_me
PORT=4000
OWNER_EMAIL=owner@jobshob.com
OWNER_PASSWORD=your_secure_password_here
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
```

⚠️ **For now, skip `MONGO_URI` and `FRONTEND_ORIGIN`** — we'll get them in the next steps

4. Click **"Create Web Service"**

### 2.4 Backend URL
After deployment, you'll get a URL like:
```
https://job-shob-api.onrender.com
```

Save this — you'll need it soon!

---

## 🗄️ Step 3: Setup MongoDB Atlas (Cloud Database)

### 3.1 Create MongoDB Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Sign up"** and create account

### 3.2 Create Free Cluster
1. Click **"Create"** → **"Create a free cluster"**
2. Select:
   - **Cloud Provider:** AWS (or your choice)
   - **Region:** Closest to you
   - **Cluster Name:** `job-shob`
3. Click **"Create Cluster"** (takes 2-3 minutes)

### 3.3 Create Database User
1. Go to **"Security"** → **"Database Access"**
2. Click **"Add New Database User"**
3. Fill in:
   - **Username:** `jobshob_user`
   - **Password:** Create a strong password (copy it!)
4. Click **"Add User"**

### 3.4 Allow Network Access
1. Go to **"Security"** → **"Network Access"**
2. Click **"Add IP Address"**
3. Select **"Allow access from anywhere"** (0.0.0.0/0)
4. Click **"Confirm"**

⚠️ This allows Render to access your database

### 3.5 Get Connection String
1. Go to **"Databases"** tab
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"** → **"Node.js"**
4. Copy the connection string:
   ```
   mongodb+srv://jobshob_user:<password>@cluster0.xxxxx.mongodb.net/jobshob?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password

### 3.6 Update Render Environment
1. Go back to Render dashboard
2. Open your service → **"Environment"**
3. Update `MONGO_URI` with the connection string from step 3.5
4. Click **"Save"** — Render auto-redeploys

✅ Database is ready!

---

## 🎨 Step 4: Deploy Frontend on Vercel

### 4.1 Create Vercel Account
1. Go to https://vercel.com
2. Click **"Sign Up"** → Choose **"GitHub"** login
3. Authorize Vercel to access your GitHub repos

### 4.2 Import Project
1. Click **"New Project"**
2. Select your `job-shob` repository
3. Click **"Import"**
4. Configure:
   - **Framework Preset:** Other (our project is static HTML)
   - **Root Directory:** `.` (leave empty)
   - Leave other settings as default
5. Click **"Deploy"**

### 4.3 Get Frontend URL
After deployment, you'll see a URL like:
```
https://job-shob.vercel.app
```

Save this!

### 4.4 Update Backend FRONTEND_ORIGIN
1. Go to Render dashboard
2. Open your backend service → **"Environment"**
3. Update `FRONTEND_ORIGIN`:
   ```
   https://job-shob.vercel.app
   ```
4. Click **"Save"** — auto-redeploys

---

## ⚙️ Step 5: Configure Frontend API URL

### 5.1 Set Backend URL in Frontend
1. Open `index.html` in your project
2. Find this section (around line 240):
   ```html
   <script>
     // For Vercel frontend + Render backend deployment, uncomment and set:
     // window.API_BASE_URL = 'https://job-shob-backend.onrender.com';
   </script>
   ```
3. Uncomment and update with your Render backend URL:
   ```html
   <script>
     window.API_BASE_URL = 'https://job-shob-api.onrender.com';
   </script>
   ```

### 5.2 Commit and Push
```powershell
cd "C:\Users\user\Desktop\Job Shob Main"
git add index.html
git commit -m "Configure backend API URL for production"
git push origin main
```

Vercel will auto-redeploy!

---

## 🧪 Step 6: Test Everything

### 6.1 Test Backend Health
Open in browser:
```
https://job-shob-api.onrender.com/health
```

Should show: `{"ok":true}`

### 6.2 Test Frontend
Open in browser:
```
https://job-shob.vercel.app
```

Should load the website!

### 6.3 Test Login
1. Click **"Owner Login"** button
2. Enter:
   - Email: `owner@jobshob.com`
   - Password: `owner123456`
3. Should see the owner panel

### 6.4 Test Real-Time Upload
1. Login as owner
2. Try adding a link/video
3. Should appear instantly (no page refresh needed)

---

## 📝 Environment Variables Summary

| Service | Variable | Value |
|---------|----------|-------|
| **Render** | MONGO_URI | MongoDB Atlas connection string |
| **Render** | JWT_SECRET | Any random string (e.g., `jobshob_secret_2024`) |
| **Render** | PORT | 4000 |
| **Render** | OWNER_EMAIL | owner@jobshob.com |
| **Render** | OWNER_PASSWORD | Your secure password |
| **Render** | FRONTEND_ORIGIN | https://your-app.vercel.app |
| **index.html** | API_BASE_URL | https://your-render-backend.onrender.com |

---

## 🔐 Security Checklist

- [ ] Change `OWNER_PASSWORD` to something strong
- [ ] Change `JWT_SECRET` to a random string
- [ ] Don't commit `.env` files to GitHub
- [ ] Never expose API keys in frontend
- [ ] MongoDB whitelist limited to Render IP (optional: safer)
- [ ] Use HTTPS everywhere (Vercel & Render provide free SSL)

---

## 🚨 Troubleshooting

### Login fails with "network error"
- Check `API_BASE_URL` is set correctly in `index.html`
- Check backend health: https://your-backend.onrender.com/health

### MongoDB connection error
- Verify `MONGO_URI` is correct
- Check MongoDB Atlas whitelist includes Render IPs (0.0.0.0/0)
- Check username/password in connection string

### Real-time updates not working
- Check WebSocket connections in browser DevTools
- Verify `FRONTEND_ORIGIN` on Render backend

### Changes not appearing after push
- Vercel: Usually deploys within 1-2 minutes (check Deployments tab)
- Render: Free tier may sleep after 15 min of inactivity (click "Restart" to wake)

---

## 📚 Useful Links

- GitHub: https://github.com/YOUR_USERNAME/job-shob
- Vercel Dashboard: https://vercel.com/dashboard
- Render Dashboard: https://dashboard.render.com
- MongoDB Atlas: https://cloud.mongodb.com

---

## ✨ Next Steps (Optional)

1. **Custom Domain** → Add your own domain to Vercel
2. **Auto-Deploy on Push** → Already setup! Push to main = auto-deploy
3. **S3 for PDFs** → Add AWS credentials to Render for PDF storage
4. **Email Notifications** → Add SendGrid/AWS SES for contact form
5. **Analytics** → Add Google Analytics or Vercel Analytics

---

**Deployment Complete!** 🎉

Your Job Shob website is now live!
- Frontend: https://job-shob.vercel.app
- Backend API: https://job-shob-api.onrender.com
- Database: MongoDB Atlas

