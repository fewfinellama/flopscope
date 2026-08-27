# 🚀 Deploying Flopscope to Cloudflare (100% Free, Global Edge, Max Speed)

This guide walks you through deploying **Flopscope** to **Cloudflare Pages & Workers** for **0ms cold starts, unlimited free bandwidth, enterprise DDoS protection, and global edge caching across 330+ cities**.

---

## 🌟 Why Cloudflare is the Best Choice
- **⚡ 0ms Cold Starts:** Unlike Render/Railway (which take 50s to wake up on free tiers), Cloudflare V8 isolates start instantly.
- **🌐 Unlimited Free Bandwidth:** No 100GB monthly caps.
- **🔒 Free SSL & DDoS Mitigation:** Automatic SSL on custom domains (`explorer.yourdomain.com`).
- **🗄️ Free Edge Database (Cloudflare D1):** 5,000,000 free reads/day for permanent message history.

---

## 📋 Prerequisites
1. A free **[Cloudflare Account](https://dash.cloudflare.com/sign-up)**.
2. Your Flopscope code pushed to a **GitHub** or **GitLab** repository.

---

## 🛠️ Method 1: Deploy via Cloudflare Dashboard (Easiest — 2 Minutes)

### Step 1: Connect your GitHub Repository
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** in the left sidebar ➔ Click **Create Application** ➔ Select the **Pages** tab.
3. Click **Connect to Git** and select your `flopscope` repository.

### Step 2: Configure Build Settings
Fill in the deployment settings:
- **Project Name:** `flopscope` (or your choice)
- **Production Branch:** `main` (or `master`)
- **Framework preset:** `None` (or `Custom`)
- **Build command:** *(Leave empty)*
- **Build output directory:** `public`

### Step 3: Deploy
- Click **Save and Deploy**.
- Cloudflare will build and deploy your site in ~30 seconds.
- You will receive a live URL: `https://flopscope.pages.dev`! 🎉

---

## 🗄️ Optional: Enable Cloudflare D1 for Infinite History

If you want permanent historical message archiving with Cloudflare's free SQLite database:

### 1. Create a D1 Database in Cloudflare Dashboard
1. Go to **Workers & Pages** ➔ **D1 SQL Database** ➔ Click **Create Database**.
2. Name it: `flopscope-db`.

### 2. Initialize the Database Schema
In the Cloudflare D1 console (or via CLI), run:
```sql
CREATE TABLE IF NOT EXISTS messages (
  room TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ts TEXT,
  from_did TEXT,
  text TEXT,
  raw_text TEXT,
  nonce TEXT,
  sig TEXT,
  is_signed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room, seq)
);
CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room, seq DESC);
CREATE INDEX IF NOT EXISTS idx_messages_did ON messages (from_did);
```

### 3. Bind D1 to your Pages Project
1. In your Pages project settings ➔ Go to **Settings** ➔ **Functions**.
2. Scroll to **D1 Database Bindings** ➔ Click **Add binding**.
3. Set **Variable name** to `DB` and select your `flopscope-db`.
4. Redeploy your project.

---

## 💻 Method 2: Deploy via Wrangler CLI

If you prefer deploying from your terminal:

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Create your free D1 Database (Optional)
wrangler d1 create flopscope-db

# 4. Deploy directly to Cloudflare Pages
npx wrangler pages deploy public --project-name flopscope
```

---

## 🌐 Custom Domain Setup
1. In your Cloudflare Pages dashboard, go to the **Custom Domains** tab.
2. Click **Set up a custom domain**.
3. Enter your domain (e.g., `explorer.flop.sh` or `flopscope.com`).
4. Cloudflare will automatically provision a free SSL/TLS certificate with zero downtime.

---

## 🔍 Local Development vs. Production
- **Local Development:** Run `npm start` to run the Express + native SQLite server locally on `http://localhost:3000`.
- **Production (Cloudflare):** Automatically serves static assets from `/public` and routes all `/api/*` endpoints through `functions/api/[[route]].js`.
